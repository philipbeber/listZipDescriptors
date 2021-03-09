import { promises } from "fs";
import { exit } from "process";

let offset = 0;

if (process.argv.length < 3) {
    console.error("Usage: ts-node <this-script> <zipfile>");
    exit(-1);
}

listZipDescriptors(process.argv[2]);

enum RecordType {
    LocalFileHeader = "LocalFile",
    DataDescriptor = "DataDescriptor",
    CentralDirectoryFileHeader = "CentralDirectoryFileHeader",
    EndOfCentralDirectory = "EndOfCentralDirectory",
    EndOfFile = "EndOfFile"
}

async function listZipDescriptors(inputFile: string) {
    let count = 0;
    const file = await promises.open(inputFile, 'r');
    while(true) {
        const headerType = await readToNextHeader(file);
        console.log(`Header type: ${headerType}`)
        console.log(`Offset: ${offset - 4}`);
        switch(headerType) {
            case RecordType.EndOfFile:
                return;
            case RecordType.LocalFileHeader: {
                const version = await readBytes(file, 2);
                console.log(`Version: ${version.toString('hex')}`);
                const gp = await readBytes(file, 2);
                console.log(`General purpose bit: ${gp.toString('hex')}`);
                const method = await readBytes(file, 2);
                console.log(`Compression method: ${method.toString('hex')}`);
                const lastModeTime = await readBytes(file, 2);
                console.log(`Last mode file time: ${lastModeTime.toString('hex')}`);
                const lastModeDate = await readBytes(file, 2);
                console.log(`Last mode file date: ${lastModeDate.toString('hex')}`);
                const crc32 = await readBytes(file, 4);
                console.log(`crc-32: ${crc32.toString('hex')}`);
                const compressedSize = await readSize(file, 4);
                console.log(`compressed size: ${compressedSize}`);
                const uncompressedSize = await readSize(file, 4);
                console.log(`uncompressed size: ${uncompressedSize}`);
                const fileNameLength = await readSize(file, 2);
                console.log(`file name length: ${fileNameLength}`);
                const extraFieldLength = await readSize(file, 2);
                console.log(`extra field length: ${extraFieldLength}`);
                const filename = await readBytes(file, fileNameLength, false);
                console.log(`filename: ${filename}`);
                console.log(`count: ${++count}`);
                break;
            }
            case RecordType.DataDescriptor: {
                const crc32 = await readBytes(file, 4);
                console.log(`crc-32: ${crc32.toString('hex')}`);
                const compressedSize = await readSize(file, 4);
                console.log(`compressed size: ${compressedSize}`);
                const uncompressedSize = await readSize(file, 4);
                console.log(`uncompressed size: ${uncompressedSize}`);
                break;
            }
            case RecordType.CentralDirectoryFileHeader: {
                const versionMadeBy = await readBytes(file, 2);
                console.log(`Version made by: ${versionMadeBy.toString('hex')}`);
                const version = await readBytes(file, 2);
                console.log(`Version needed to extract: ${version.toString('hex')}`);
                const gp = await readBytes(file, 2);
                console.log(`General purpose bit: ${gp.toString('hex')}`);
                const method = await readBytes(file, 2);
                console.log(`Compression method: ${method.toString('hex')}`);
                const lastModeTime = await readBytes(file, 2);
                console.log(`Last mode file time: ${lastModeTime.toString('hex')}`);
                const lastModeDate = await readBytes(file, 2);
                console.log(`Last mode file date: ${lastModeDate.toString('hex')}`);
                const crc32 = await readBytes(file, 4);
                console.log(`crc-32: ${crc32.toString('hex')}`);
                const compressedSize = await readSize(file, 4);
                console.log(`compressed size: ${compressedSize}`);
                const uncompressedSize = await readSize(file, 4);
                console.log(`uncompressed size: ${uncompressedSize}`);
                const fileNameLength = await readSize(file, 2);
                console.log(`file name length: ${fileNameLength}`);
                const extraFieldLength = await readSize(file, 2);
                console.log(`extra field length: ${extraFieldLength}`);
                const fileCommentLength = await readSize(file, 2);
                console.log(`File comment length: ${fileCommentLength}`);
                const diskNumber = await readSize(file, 2);
                console.log(`Disk number where file starts: ${diskNumber}`);
                const internalFileAttributes = await readBytes(file, 2);
                console.log(`Internal file attributes: ${internalFileAttributes}`);
                const externalFileAttributes = await readBytes(file, 4);
                console.log(`External file attributes: ${externalFileAttributes}`);
                const relativeOffset = await readBytes(file, 4);
                console.log(`Relative offset: ${relativeOffset}`);
                const filename = await readBytes(file, fileNameLength, false);
                console.log(`filename: ${filename}`);
                console.log(`count: ${++count}`);
                break;
            }
            case RecordType.EndOfCentralDirectory: {
                const thisDisk = await readSize(file, 2);
                console.log(`Number of this disk: ${thisDisk}`);
                const startDisk = await readSize(file, 2);
                console.log(`Disk where central directory starts: ${startDisk}`);
                const recordsOnThisDisk = await readSize(file, 2);
                console.log(`Records on this disk: ${recordsOnThisDisk}`);
                const totalRecords = await readSize(file, 2);
                console.log(`Total records: ${totalRecords}`);
                const cdSize = await readSize(file, 4);
                console.log(`Central directory size: ${cdSize}`);
                const offset = await readSize(file, 4);
                console.log(`Central directory offset: ${offset}`);
                const commentLength = await readSize(file, 2);
                console.log(`Comment length: ${commentLength}`);
                break;
            }
        }
    }
}

async function readBytes(file: promises.FileHandle, count: number, reverse = true) {
    if (!count) {
        return Buffer.alloc(0);
    }
    const buffer = (await readBuffer(file, count)).buffer;
    if (reverse) {
        buffer.reverse();
    }
    return buffer;
}

const cache = Buffer.alloc(1024);
let cacheSize = 0;
let cacheOffset = 0;
let endOfFile = false;

async function readBuffer(file: promises.FileHandle, count: number) {
    if (endOfFile) {
        return { eof: true };
    }

    const bytesAvailable = cacheSize - cacheOffset;
    if (bytesAvailable >= count) {
        const buffer = cache.slice(cacheOffset, cacheOffset + count);
        cacheOffset += count;
        offset += count;
        return { buffer };
    }

    const bytesNeeded = count - bytesAvailable;
    const buffer = Buffer.alloc(count);
    cache.copy(buffer, 0, cacheOffset, cacheOffset + bytesAvailable);

    const res = await file.read(cache, 0, 1024, offset);

    if (!res.bytesRead || res.bytesRead < bytesNeeded) {
        endOfFile = true;
        return { eof: true };
    }

    cache.copy(buffer, bytesAvailable, 0, bytesNeeded);
    cacheSize = res.bytesRead;
    cacheOffset = bytesNeeded;
    offset += count;

    return { buffer };
}

async function readSize(file: promises.FileHandle, count: number) {
    const buffer = await readBytes(file, count);
    let size = 0;
    for (let i = 0; i < count; i++) {
        size = size * 256 + buffer[i];
    }
    return size;
}

async function readToNextHeader(file: promises.FileHandle) {
    const pkHeader = [0x50, 0x4b]; // KP in little endian

    const headers = [
        {
            type: RecordType.LocalFileHeader,
            byte3: 0x03,
            byte4: 0x04
        },
        {
            type: RecordType.DataDescriptor,
            byte3: 0x07,
            byte4: 0x08
        },
        {
            type: RecordType.CentralDirectoryFileHeader,
            byte3: 0x01,
            byte4: 0x02
        },
        {
            type: RecordType.EndOfCentralDirectory,
            byte3: 0x05,
            byte4: 0x06
        },
    ]

    let headerIndex = 0;
    let curHeader: typeof headers[0];
    while (true) {
        const {buffer, eof} = await readBuffer(file, 1);
        if (eof) {
            return RecordType.EndOfFile;
        }

        const curByte = buffer[0];
        if (headerIndex < 2) {
            if (curByte === pkHeader[headerIndex]) {
                headerIndex++;
            } else {
                headerIndex = 0;
            }
        } else if (headerIndex === 2) {
            curHeader = null;
            for (let header of headers) {
                if (curByte === header.byte3) {
                    curHeader = header;
                    break;
                }
            }
            if (curHeader) {
                headerIndex++;
            } else {
                headerIndex = 0;
            }
        } else if (headerIndex === 3) {
            if (curByte === curHeader.byte4) {
                return curHeader.type;
            }
            headerIndex = 0;
        }
    }
}
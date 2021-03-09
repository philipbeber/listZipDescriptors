# listZipDescriptors
Parse a zip file and print out what's in there

Simply scans through the zip and prints out whatever file descriptors it finds in there. Useful if you have a corrupt zip file and you're trying to figure out what's wrong with it. In theory the files that are listed aren't necessarily part of the zip, since you can delete a file by appending a new central directory that doesn't list that file. But no one does that unless it's 1986 and their zip file spans multiple floppy disks. 
## Usage

```
npx ts-node listzipdescriptors.ts <path-to-zip-file>
```


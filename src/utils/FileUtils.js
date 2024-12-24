class FileUtils {
    static getFilenameWithoutExtension(filename) {
        if (filename == undefined || filename == null) return ''; //todo

        const lastDotIndex = filename.lastIndexOf('.');
        if (lastDotIndex === -1) {
            return filename;
        }
        return filename.substring(0, lastDotIndex);
    }
}

export { FileUtils };
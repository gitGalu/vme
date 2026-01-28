class FileUtils {
    static getFilenameWithoutExtension(filename) {
        if (filename == undefined || filename == null) return ''; //todo

        const lastDotIndex = filename.lastIndexOf('.');
        if (lastDotIndex === -1) {
            return filename;
        }
        return filename.substring(0, lastDotIndex);
    }

    static ensureDir(FS, dirPath) {
        if (!dirPath || dirPath === "/") return;

        const parts = dirPath.split("/").filter(Boolean);
        let cur = "";
        for (const p of parts) {
            cur += "/" + p;
            if (!FS.analyzePath(cur).exists) FS.mkdir(cur);
        }
    }

    static safeJoin(base, rel) {
        // Normalize slashes, remove drive letters, prevent traversal
        let r = rel.replace(/\\/g, "/");
        r = r.replace(/^[A-Za-z]:\//, "");      // strip "C:/"
        r = r.replace(/^\/+/, "");              // strip leading "/"
        // kill ".." segments
        const clean = [];
        for (const seg of r.split("/")) {
            if (!seg || seg === ".") continue;
            if (seg === "..") continue; // or throw new Error("Path traversal in zip");
            clean.push(seg);
        }
        return base.replace(/\/+$/, "") + "/" + clean.join("/");
    }

    static async unzipToEmscriptenFS(zipContent, FS, destDir) {
        FileUtils.ensureDir(FS, destDir);

        // zipContent.files is an object: { "path/in/zip": ZipObject, ... }
        const entries = Object.entries(zipContent.files);

        for (const [name, entry] of entries) {
            if (entry.dir) {
                const outDir = FileUtils.safeJoin(destDir, name);
                FileUtils.ensureDir(FS, outDir);
                continue;
            }

            const outPath = FileUtils.safeJoin(destDir, name);
            const parentDir = outPath.substring(0, outPath.lastIndexOf("/")) || "/";
            FileUtils.ensureDir(FS, parentDir);

            const data = await entry.async("uint8array");
            FS.writeFile(outPath, data, { encoding: "binary" });
        }
    }
}

export { FileUtils };

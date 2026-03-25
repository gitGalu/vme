import CryptoJS from 'crypto-js';

export async function computeBlobSha256(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function (event) {
            const data = event.target.result;
            const wordArray = CryptoJS.lib.WordArray.create(data);
            const hash = CryptoJS.SHA256(wordArray).toString();
            resolve(hash);
        };
        reader.onerror = function (error) {
            reject(error);
        };
        reader.readAsArrayBuffer(blob);
    });
}

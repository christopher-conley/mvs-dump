import createCert from 'create-cert'
import fs from "fs"

console.log(createCert)
createCert().then(keys => {
    fs.writeFile("key.pem", keys.key, (err) => {
        console.log(err);
    })
    fs.writeFile("cert.pem", keys.cert, (err) => {
        console.log(err);
    })
    fs.writeFile("cert1crt", keys.cert, (err) => {
        console.log(err);
    })
});

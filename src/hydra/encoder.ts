import { HydraBufferReader } from "./hydraBufferReader.js";
import fs from "fs";

export class HydraCommand {
    code: number;
    bufferSizeBytes: number;
    offset = 0;
}
export class HydraEncoder {
    private chunks: Buffer[] = [];
    private totalLength = 0;
    private isWebsocket: boolean;

    constructor(_isWebsocket = false) {

        this.isWebsocket = _isWebsocket;
    }


    encodeValue(data: any[] | Object) {
        if (data === null) {
            return this.encodeNull();
        }
        if (typeof data === "boolean") {
            return this.encodeBoolean(data);
        } else if (data instanceof Date) {
            return this.encodeDate(data);
        }
        if (typeof data === "object") {
            if (Array.isArray(data)) {
                return this.encodeArray(data);
            } else {
                return this.encodeObject(data);
            }
        } else if (typeof data === "string") {
            return this.encodeString(data);
        } else if (!Number.isNaN(data)) {
            return this.encodeNumber(data);
        }
    }

    encodeNull() {
        const buffer = Buffer.alloc(1);
        buffer.writeInt8(1, 0);
        this.pushBuffer(buffer);
    }

    encodeBoolean(value: boolean) {
        const buffer = Buffer.alloc(1);
        if (value === true) {
            buffer.writeInt8(2, 0);
        } else if (value === false) {
            buffer.writeInt8(3, 0);
        }
        this.pushBuffer(buffer);
    }

    encodeDate(value: Date) {
        const time = Math.floor(value.getTime() / 1000);
        const hydraCmd = new HydraCommand();
        hydraCmd.code = 0x40;
        hydraCmd.bufferSizeBytes = 4;

        const buffer = Buffer.alloc(1 + hydraCmd.bufferSizeBytes);
        this.writeInt(buffer, hydraCmd.code, 1, hydraCmd.offset);
        hydraCmd.offset++;
        this.writeInt(buffer, time, hydraCmd.bufferSizeBytes, hydraCmd.offset);
        this.pushBuffer(buffer);
    }

    encodeArray(data: Object[]) {
        const size = data.length;
        const hydraCmd = new HydraCommand();

        if (size < 256) {
            hydraCmd.code = 0x50;
            hydraCmd.bufferSizeBytes = 1;
        } else if (size > 255) {
            hydraCmd.code = 0x51;
            hydraCmd.bufferSizeBytes = 2;
        } else if (size > 4294967295) {
            hydraCmd.code = 0x52;
            hydraCmd.bufferSizeBytes = 4;
        } else if (size > 18446744073709551615) {
            hydraCmd.code = 0x33;
            hydraCmd.bufferSizeBytes = 8;
        }

        const buffer = Buffer.alloc(1 + hydraCmd.bufferSizeBytes);
        this.writeInt(buffer, hydraCmd.code, 1, hydraCmd.offset);
        hydraCmd.offset++;

        this.writeInt(buffer, size, hydraCmd.bufferSizeBytes, hydraCmd.offset);
        this.pushBuffer(buffer);

        for (let inner of data) {
            this.encodeValue(inner);
        }
    }

    encodeObject(data: Object) {
        const size = Object.keys(data).length;
        const hydraCmd = new HydraCommand();

        if (size < 256) {
            hydraCmd.code = 0x60;
            hydraCmd.bufferSizeBytes = 1;
        } else if (size > 255) {
            hydraCmd.code = 0x61;
            hydraCmd.bufferSizeBytes = 2;
        } else if (size > 4294967295) {
            hydraCmd.code = 0x62;
            hydraCmd.bufferSizeBytes = 4;
        } else if (size > 18446744073709551615) {
            hydraCmd.code = 0x63;
            hydraCmd.bufferSizeBytes = 8;
        }
        const buffer = Buffer.alloc(1 + hydraCmd.bufferSizeBytes);
        this.writeInt(buffer, hydraCmd.code, 1, hydraCmd.offset);
        hydraCmd.offset++;

        this.writeInt(buffer, size, hydraCmd.bufferSizeBytes, hydraCmd.offset);
        hydraCmd.offset++;
        this.pushBuffer(buffer);

        for (const [key, value] of Object.entries(data)) {
            this.encodeString(key);
            this.encodeValue(value);
        }
    }

    encodeString(value: string) {
        const hydraCmd = new HydraCommand();
        const stringSize = value.length;

        if (stringSize < 256) {
            hydraCmd.code = 0x30;
            hydraCmd.bufferSizeBytes = 1;
        } else if (stringSize > 255) {
            hydraCmd.code = 0x31;
            hydraCmd.bufferSizeBytes = 2;
        } else if (stringSize > 4294967295) {
            hydraCmd.code = 0x32;
            hydraCmd.bufferSizeBytes = 4;
        }

        const buffer = Buffer.alloc(1 + hydraCmd.bufferSizeBytes + stringSize);
        this.writeInt(buffer, hydraCmd.code, 1, hydraCmd.offset);
        hydraCmd.offset++;
        this.writeInt(
            buffer,
            stringSize,
            hydraCmd.bufferSizeBytes,
            hydraCmd.offset
        );
        hydraCmd.offset += hydraCmd.bufferSizeBytes;

        buffer.write(value, hydraCmd.offset);
        this.pushBuffer(buffer);
        return value;
    }

    encodeNumber(value: number) {
        const hydraCmd = new HydraCommand();

        if (!Number.isInteger(value)) {
            hydraCmd.code = 0x21;
            hydraCmd.bufferSizeBytes = 8;
        } else if (value < 0) {
            hydraCmd.code = 0x16;
            hydraCmd.bufferSizeBytes = 8;
        } else if (value <= 255) {
            hydraCmd.code = 0x11;
            hydraCmd.bufferSizeBytes = 1;
        } else if (value <= 65535) {
            hydraCmd.code = 0x13;
            hydraCmd.bufferSizeBytes = 2;
        } else if (value <= 4294967295) {
            hydraCmd.code = 0x15;
            hydraCmd.bufferSizeBytes = 4;
        } else if (value <= 18446744073709551615) {
            hydraCmd.code = 0x17;
            hydraCmd.bufferSizeBytes = 8;
        }

        const buffer = Buffer.alloc(1 + hydraCmd.bufferSizeBytes);
        buffer.writeUint8(hydraCmd.code);
        hydraCmd.offset++;

        this.writeInt(buffer, value, hydraCmd.bufferSizeBytes, hydraCmd.offset);

        this.pushBuffer(buffer);
    }

    writeInt(buffer: Buffer, value: number, bufferSize: number, offset: number) {
        switch (bufferSize) {
            case 1:
                buffer.writeUint8(value, offset);
                break;
            case 2:
                buffer.writeUint16BE(value, offset);
                break;
            case 4:
                buffer.writeUint32BE(value, offset);
                break;
            case 8:
                if (!Number.isInteger(value)) {
                    buffer.writeDoubleBE(value, offset);
                } else if (value < 0) {
                    buffer.writeBigInt64BE(BigInt(value), offset);
                } else {
                    buffer.writeBigUint64BE(BigInt(value), offset);
                }

                break;
        }
    }

    pushBuffer(buffer: Buffer) {
        this.chunks.push(buffer);
        this.totalLength += buffer.length;
    }

    returnValue() {
        if (this.isWebsocket) {
            let buffer = Buffer.alloc(3);
            buffer.writeUint8(6, 0);
            buffer.writeUInt16BE(this.totalLength, 1);
            this.totalLength += 3;
            this.chunks.unshift(buffer);
        }
        return Buffer.concat(this.chunks, this.totalLength);
    }
}

if (process.argv[2]) {
    fs.readFile(process.argv[2], "utf-8", (err, data) => {
        let isWebsocket = false;
        const t0 = performance.now();
        if (process.argv[3]) {
            isWebsocket = true;
        }
        const encoder = new HydraEncoder(isWebsocket);
        encoder.encodeValue(JSON.parse(data));
        const buffer = encoder.returnValue();
        const t1 = performance.now();
        console.log(`Execution time: ${t1 - t0} ms`);
        fs.writeFileSync(`${process.argv[2]}.bin`, buffer)
        console.log(buffer?.toString("hex"));
    });
}
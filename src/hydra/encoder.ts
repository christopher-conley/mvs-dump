import { BYTESIZE, CODES } from "./hydra.js";
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
        hydraCmd.code = CODES.DATE
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

        if (size <= BYTESIZE.BYTE8) {
            hydraCmd.code = CODES.ARRAY8;
            hydraCmd.bufferSizeBytes = 1;
        } else if (size <= BYTESIZE.BYTE16) {
            hydraCmd.code = CODES.ARRAY16;
            hydraCmd.bufferSizeBytes = 2;
        } else if (size <= BYTESIZE.BYTE32) {
            hydraCmd.code = CODES.ARRAY32;
            hydraCmd.bufferSizeBytes = 4;
        } else if (size <= BYTESIZE.BYTE64) {
            hydraCmd.code = CODES.ARRAY64;
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

        if (size <= BYTESIZE.BYTE8) {
            hydraCmd.code = CODES.MAP8;
            hydraCmd.bufferSizeBytes = 1;
        } else if (size <= BYTESIZE.BYTE16) {
            hydraCmd.code = CODES.MAP16;
            hydraCmd.bufferSizeBytes = 2;
        } else if (size <= BYTESIZE.BYTE32) {
            hydraCmd.code = CODES.MAP32;
            hydraCmd.bufferSizeBytes = 4;
        } else if (size <= BYTESIZE.BYTE64) {
            hydraCmd.code = CODES.MAP64;
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

        if (stringSize <= BYTESIZE.BYTE8) {
            hydraCmd.code = CODES.CHAR8;
            hydraCmd.bufferSizeBytes = 1;
        } else if (stringSize <= BYTESIZE.BYTE16) {
            hydraCmd.code = CODES.CHAR16;
            hydraCmd.bufferSizeBytes = 2;
        } else if (stringSize <= BYTESIZE.BYTE32) {
            hydraCmd.code = CODES.CHAR32;
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
            hydraCmd.code = CODES.DOUBLE;
            hydraCmd.bufferSizeBytes = 8;
        } else if (value < 0) {
            hydraCmd.code = CODES.INT64;
            hydraCmd.bufferSizeBytes = 8;
        } else if (value <= BYTESIZE.BYTE8) {
            hydraCmd.code = CODES.UINT8;
            hydraCmd.bufferSizeBytes = 1;
        } else if (value <= BYTESIZE.BYTE16) {
            hydraCmd.code = CODES.UINT16;
            hydraCmd.bufferSizeBytes = 2;
        } else if (value <= BYTESIZE.BYTE32) {
            hydraCmd.code = CODES.UINT32;
            hydraCmd.bufferSizeBytes = 4;
        } else if (value <= BYTESIZE.BYTE64) {
            hydraCmd.code = CODES.UINT64
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
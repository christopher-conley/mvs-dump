type byteType = "int8" | "uint8" | "int16" | "uint16" | "int32" | "uint32" | "int64" | "uint64" | "float" | "double" | "binary"

export class HydraBufferReader {
    _buffer: Uint8Array;
    position: number;
    constructor(buffer: Buffer) {
        this._buffer = buffer
        this.position = 0;
    }

    get endOfRead() {
        return this.position >= this._buffer.byteLength;
    }

    read(length: number, byteType: byteType) {

        let result: number | ArrayBufferLike = 0;
        try {
            const slice = this._buffer.slice(this.position, this.position + length)
            const buffer = Buffer.from(slice);
            switch (byteType) {
                case "int8": {
                    result = buffer.readInt8(0)
                    break;
                }
                case "uint8": {
                    result = buffer.readUInt8(0);
                    break;
                }
                case "int16": {
                    result = buffer.readInt16BE(0);
                    break;
                }
                case "uint16": {
                    result = buffer.readUInt16BE(0);
                    break;
                }
                case "int32": {
                    result = buffer.readInt32BE(0);
                    break;
                }
                case "uint32": {
                    result = buffer.readUInt32BE(0);
                    break;
                }
                case "int64": {
                    result = Number(buffer.readBigInt64BE(0));
                    break;
                }
                case "uint64": {
                    result = Number(buffer.readBigUInt64BE(0));
                    break;
                }
                case "float": {
                    result = buffer.readFloatBE(0);
                    break;
                }
                case "double": {
                    result = buffer.readDoubleBE(0);
                    break;
                }
                case "binary": {
                    result = this._buffer.buffer
                    break;
                }
            }
        } catch (e) {
            console.log(e);
            return result;
        }
        this.position += length;
        return result;
    }

    readToByte(length) {
        const bytes = this._buffer.slice(this.position, this.position + length);
        this.position += length;
        return bytes;
    }

    readString(length) {
        const bytes = this.readToByte(length)
        const text = new TextDecoder('ascii').decode(bytes); // Assumes ASCII encoding;
        return text;
    }
}
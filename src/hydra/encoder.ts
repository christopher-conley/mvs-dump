import { HydraBufferReader } from "./hydraBufferReader.js";
import fs from "fs"

export class HydraCommand {
    code: number;
    bufferSizeBytes: number;
    offset = 0;
}
export class HydraEncoder {
    private _buf: HydraBufferReader;
    private chunks: Buffer[] = [];
    private totalLength = 0;


    readArray(count) {
        const ret = new Array(count);

        for (let i = 0; i < count; i++) {
            const val = this.readValue();

            if (val === null) continue;

            ret[i] = val;
        }

        return ret;
    }

    readMap(count) {
        const ret: Record<any, any> = {};

        for (let i = 0; i < count; i++) {
            const key = this.readValue() as string;
            const value = this.readValue();

            if (key === null) continue;

            ret[key] = value;
        }

        return ret;
    }

    readLocalization() {
        const emptyCode = this.readValue();
        const defaultParam = this.readValue();
        const key = this.readValue() as string;
        const value = this.readValue() as string;

        const localizations: Localization = {
            localizations: {
                [key]: value,
            }
        }


        return localizations;
    }

    readCalendar() {
        const defaultValue = this.readValue() as boolean;
        const renderedValue = this.readValue() as boolean;

        const calendar: HydraDefaultAndRendered = {
            default: defaultValue,
            rendered: renderedValue
        }

        return calendar;
    }

    readFileRef() {
        const model_cls = this.readValue() as string;
        const ref = this.readValue() as string;

        const values = this.readValue() as Record<string, any>;

        const hydraFileref: HydraFileRef = {
            _customType: "hydra_reference",
            value: values,
        }

        return hydraFileref;
    }

    readStoreEnabled() {
        const defaultValue = this.readValue() as boolean;
        const renderedValue = this.readValue() as boolean;
        const values = this.readValue() as any;
        const hydraDefAndRen: HydraEnabled = {
            default: defaultValue,
            rendered: null,
            values: values,
        }

        return hydraDefAndRen;
    }

    encodeValue(data: any[] | Object) {
        if (data === null) {
            return null;
        }
        if (data instanceof Date) {
            this.encodeDate(data)
        }
        if (typeof data === 'object') {
            if (Array.isArray(data)) {
                this.encodeArray(data);
            } else {
                this.encodeObject(data);
            }
        } else if (typeof data === "string") {
            this.encodeString(data);

        } else if (!Number.isNaN(data)) {
            this.encodeNumber(data);
        }
        return Buffer.concat(this.chunks, this.totalLength);
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
        this.pushBuffer(buffer)
    }

    encodeArray(data: Object[]) {
        const size = data.length;
        const hydraCmd = new HydraCommand();

        if (size < 256) {
            hydraCmd.code = 0x50;
            hydraCmd.bufferSizeBytes = 1;
        } else if (size > 255) {
            hydraCmd.code = 0x51
            hydraCmd.bufferSizeBytes = 2;
        } else if (size > 4294967295) {
            hydraCmd.code = 0x52
            hydraCmd.bufferSizeBytes = 4;
        } else if (size > 18446744073709551615) {
            hydraCmd.code = 0x33
            hydraCmd.bufferSizeBytes = 8;
        }

        const buffer = Buffer.alloc(1 + hydraCmd.bufferSizeBytes);
        this.writeInt(buffer, hydraCmd.code, 1, hydraCmd.offset);
        hydraCmd.offset++;

        this.writeInt(buffer, size, hydraCmd.bufferSizeBytes, hydraCmd.offset);
        hydraCmd.offset++;
        this.pushBuffer(buffer)

        for(let inner of data) {
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
            hydraCmd.code = 0x61
            hydraCmd.bufferSizeBytes = 2;
        } else if (size > 4294967295) {
            hydraCmd.code = 0x62
            hydraCmd.bufferSizeBytes = 4;
        } else if (size > 18446744073709551615) {
            hydraCmd.code = 0x63
            hydraCmd.bufferSizeBytes = 8;
        }
        const buffer = Buffer.alloc(1 + hydraCmd.bufferSizeBytes);
        this.writeInt(buffer, hydraCmd.code, 1, hydraCmd.offset);
        hydraCmd.offset++;

        this.writeInt(buffer, size, hydraCmd.bufferSizeBytes, hydraCmd.offset);
        hydraCmd.offset++;
        this.pushBuffer(buffer)

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
            hydraCmd.code = 0x31
            hydraCmd.bufferSizeBytes = 2;
        } else if (stringSize > 4294967295) {
            hydraCmd.code = 0x32
            hydraCmd.bufferSizeBytes = 4;
        }

        const buffer = Buffer.alloc(1 + hydraCmd.bufferSizeBytes + stringSize);
        this.writeInt(buffer, hydraCmd.code, 1, hydraCmd.offset);
        hydraCmd.offset++;
        this.writeInt(buffer, stringSize, hydraCmd.bufferSizeBytes, hydraCmd.offset);
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
        }
        else if (value < 0) {
            hydraCmd.code = 0x16;
            hydraCmd.bufferSizeBytes = 8;
        } else if (value < 256) {
            hydraCmd.code = 0x10;
            hydraCmd.bufferSizeBytes = 1;
        } else if (value > 255) {
            hydraCmd.code = 0x12
            hydraCmd.bufferSizeBytes = 2;
        } else if (value > 4294967295) {
            hydraCmd.code = 0x14
            hydraCmd.bufferSizeBytes = 4;
        } else if (value > 18446744073709551615) {
            hydraCmd.code = 0x16
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
                }
                else if (value < 0) {
                    buffer.writeBigInt64BE(BigInt(value), offset);
                } else {
                    buffer.writeBigUint64BE(BigInt(value), offset);
                }


                break
        }

    }

    pushBuffer(buffer: Buffer) {
        this.chunks.push(buffer);
        this.totalLength += buffer.length;
    }

    readValue() {
        if (this._buf.endOfRead) return null;
        const val = this._buf.read(1, "int8");
        switch (val) {
            case 0x0: return 0;
            case 0x1: return null;
            case 0x2: return true;
            case 0x3: return false;
            case 0x10: return this._buf.read(1, "int8");
            case 0x11: return this._buf.read(1, "uint8");
            case 0x12: return this._buf.read(2, "int16");
            case 0x13: return this._buf.read(2, "uint16");
            case 0x14: return this._buf.read(4, "int32");
            case 0x15: return this._buf.read(4, "uint32");
            case 0x16: return this._buf.read(8, "int64");
            case 0x17: return this._buf.read(8, "uint64");
            case 0x20: return this._buf.read(4, "float");
            case 0x21: return this._buf.read(8, "double");
            case 0x30: return this._buf.readString(this._buf.read(1, "uint8"));
            case 0x31: return this._buf.readString(this._buf.read(2, "uint16"));
            case 0x32: return this._buf.readString(this._buf.read(4, "uint32"));
            case 0x33: return this._buf.read(this._buf.read(1, "uint8") as number, "binary");
            case 0x34: return this._buf.read(this._buf.read(2, "uint16") as number, "binary");
            case 0x35: return this._buf.read(this._buf.read(4, "uint32") as number, "binary");
            case 0x36: return this._buf.read(8, "uint64");
            case 0x40: return new Date(this._buf.read(4, "uint32") as number * 1000);
            case 0x50: return this.readArray(this._buf.read(1, "uint8"));
            case 0x51: return this.readArray(this._buf.read(2, "uint16"));
            case 0x52: return this.readArray(this._buf.read(4, "uint32"));
            case 0x53: return this.readArray(this._buf.read(8, "uint64"));
            case 0x60: return this.readMap(this._buf.read(1, "uint8"));
            case 0x61: return this.readMap(this._buf.read(2, "uint16"));
            case 0x62: return this.readMap(this._buf.read(4, "uint32"));
            case 0x63: return this.readMap(this._buf.read(8, "uint64"));
            //case 0x67: return this.readCompressedObject();
            case 0x68: return this.readLocalization();
            case 0x69: return this.readCalendar()
            case 0x70: return this.readFileRef()
            case 0x71: return this.readStoreEnabled()
            default: {
                console.log("HEX:", val.toString(16), "UNKNOW CODE:", val, "POS:", this._buf.position)
                return null;
            }
        }
    }

}
let json = {
    key1: "value1",
    key2: "value2",
    keyNumber1: 1,
    keyNumber256: 256,
    keyNumberNEGATIVE: -1,
    double: -0.20999319851398468,
    dateObj: new Date(),
    array1 : [1,2],
}
const encoder = new HydraEncoder()
const buffer = encoder.encodeValue(json)
console.log(buffer?.toString("hex"))

export interface Localization {
    localizations: Record<string, string>
};

export interface HydraDefaultAndRendered {
    default: boolean,
    rendered: boolean | null,
};

export interface HydraFileRef {
    "_customType": "hydra_reference",
    value: Record<string, string>,
};

export interface HydraEnabled extends HydraDefaultAndRendered {
    "values": any[]
};

export interface HydraBatchRequest {
    options: {
        allow_failures: boolean,
        parallel: boolean,
    },
    requests: HydraRequest[]
}

export interface HydraRequest {
    body?: any;
    url: string;
    verb: string;
    headers: Record<string, string>
}

export interface HydraBatchResponse {

    responses: HydraResponse[]
}

export interface HydraResponse {
    status_code: number
    body?: any;
    headers: Record<string, string>
}

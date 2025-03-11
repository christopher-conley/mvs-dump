import { HydraBufferReader } from "./hydraBufferReader.js";
import fs from "fs"
export class HydraDecoder {
    private _buf: HydraBufferReader;
    constructor(encodedStreamOrBuffer: Buffer) {
        if (Buffer.isBuffer(encodedStreamOrBuffer)) {
            this._buf = new HydraBufferReader(encodedStreamOrBuffer);
        } else {
            this._buf = new HydraBufferReader(encodedStreamOrBuffer);
        }
    }

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
if (process.argv[2]) {
    fs.readFile(process.argv[2], (err, data) => {
        if (err) {
            console.error("Error reading file:", err);
            return;
        }
        const startTime = process.hrtime();
        // Skip first 3 bytes when reading ws data
        //const slice = data.slice(3)
        const decoder = new HydraDecoder(data);
        const d = decoder.readValue();
        console.log(JSON.stringify(d))
        const endTime = process.hrtime(startTime);
        const elapsedNanoseconds = endTime[0] * 1e9 + endTime[1];
        const elapsedMilliseconds = elapsedNanoseconds / 1e6;
        console.log(`Execution time: ${elapsedMilliseconds} ms`);
    });
}

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

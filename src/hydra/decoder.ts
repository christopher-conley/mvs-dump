import { CODES, HydraDefaultAndRendered, HydraEnabled, HydraFileRef, Localization as HydraLocalization } from "./hydra.js";
import { HydraBufferReader } from "./hydraBufferReader.js";
import fs from "fs"
export class HydraDecoder {
    private reader: HydraBufferReader;

    constructor(encodedStreamOrBuffer: Buffer) {
        this.reader = new HydraBufferReader(encodedStreamOrBuffer);

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

        const localizations: HydraLocalization = {
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

    readWebSocket() {
        const size = this.reader.read(2, CODES.UINT16);
        return this.readValue();
    }

    readValue() {
        if (this.reader.endOfRead) return null;
        const val = this.reader.read(1, CODES.INT8);
        switch (val) {
            case CODES.ZERO: return 0;
            case CODES.NULL: return null;
            case CODES.TRUE: return true;
            case CODES.FALSE: return false;
            case CODES.WEBSOCKET: return this.readWebSocket();
            case CODES.INT8: return this.reader.read(1, CODES.INT8);
            case CODES.UINT8: return this.reader.read(1, CODES.UINT8);
            case CODES.INT16: return this.reader.read(2, CODES.INT16);
            case CODES.UINT16: return this.reader.read(2, CODES.UINT16);
            case CODES.INT32: return this.reader.read(4, CODES.INT32);
            case CODES.UINT32: return this.reader.read(4, CODES.UINT32);
            case CODES.INT64: return this.reader.read(8, CODES.INT64);
            case CODES.UINT64: return this.reader.read(8, CODES.UINT64);
            case CODES.FLOAT: return this.reader.read(4, CODES.FLOAT);
            case CODES.DOUBLE: return this.reader.read(8, CODES.DOUBLE);
            case CODES.CHAR8: return this.reader.readString(this.reader.read(1, CODES.UINT8));
            case CODES.CHAR16: return this.reader.readString(this.reader.read(2, CODES.UINT16));
            case CODES.CHAR32: return this.reader.readString(this.reader.read(4, CODES.UINT32));
            case CODES.BYTES8: return this.reader.read(this.reader.read(1, CODES.UINT8) as number, CODES.BYTES8);
            case CODES.BYTES16: return this.reader.read(this.reader.read(2, CODES.UINT16) as number, CODES.BYTES16);
            case CODES.BYTES32: return this.reader.read(this.reader.read(4, CODES.UINT32) as number, CODES.BYTES32);
            case CODES.BIGINT: return this.reader.read(8, CODES.UINT64);
            case CODES.DATE: return new Date(this.reader.read(4, CODES.UINT32) as number * 1000);
            case CODES.ARRAY8: return this.readArray(this.reader.read(1, CODES.UINT8));
            case CODES.ARRAY16: return this.readArray(this.reader.read(2, CODES.UINT16));
            case CODES.ARRAY32: return this.readArray(this.reader.read(4, CODES.UINT32));
            case CODES.ARRAY64: return this.readArray(this.reader.read(8, CODES.UINT64));
            case CODES.MAP8: return this.readMap(this.reader.read(1, CODES.UINT8));
            case CODES.MAP16: return this.readMap(this.reader.read(2, CODES.UINT16));
            case CODES.MAP32: return this.readMap(this.reader.read(4, CODES.UINT32));
            case CODES.MAP64: return this.readMap(this.reader.read(8, CODES.UINT64));
            //case 0x67: return this.readCompressedObject();
            case 0x68: return this.readLocalization();
            case 0x69: return this.readCalendar()
            case 0x70: return this.readFileRef()
            case 0x71: return this.readStoreEnabled()
            default: {
                console.log("HEX:", val.toString(16), "UNKNOW CODE:", val, "POS:", this.reader.position)
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
        const t0 = performance.now();
        const decoder = new HydraDecoder(data);
        const d = decoder.readValue();
        //console.log(JSON.stringify(d))

        const t1 = performance.now();
        console.log(`Execution time: ${t1 - t0} ms`);
        fs.writeFileSync("test1.json", JSON.stringify(d, null, 2))
    });
}
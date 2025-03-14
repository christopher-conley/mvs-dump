import * as mockttp from 'mockttp-mvs';
import * as fs from 'fs';
import * as crypto from 'crypto'
import { Body, PostmanCollection } from './postman.js';
import { HydraDecoder } from './hydra/decoder.js';
import { HydraBatchRequest, HydraBatchResponse } from './hydra/hydra.js';

class Proxy {

    public server: mockttp.Mockttp;

    public httpCollection: PostmanCollection = {
        "info": {
            "name": "MVS HTTP API",
            "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
        },
        item: [],
    };

    public websocketCollection: PostmanCollection = {
        "info": {
            "name": "MVS Websocket API",
            "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
        },
        item: [],
    };

    public hostnames = ["dokken-api.wbagora.com", "prod-network-api.wbagora.com", "event.wbinsights.com", "api.epicgames.dev", "api.epicgames.dev"]

    constructor() {
        this.server = mockttp.getLocal({
            https: {
                keyPath: './key.pem',
                certPath: './cert.pem',
                tlsPassthrough: [
                    { hostname: 'localhost' },
                ]
            }
        });

        process.on('SIGINT', () => {
            console.log("Save collections to file")
            process.exit(0);
        });

        process.on('exit', (code) => {
            const time = new Date().getTime();
            fs.writeFileSync(`dumps/MVS HTTP API-${time}.json`, JSON.stringify(this.httpCollection, null, 2))
            fs.writeFileSync(`dumps/MVS HTTP Websocket API-${time}.json`, JSON.stringify(this.websocketCollection, null, 2))
        });
    }


    async init() {
        this.server.forAnyRequest().thenPassThrough();
        this.server.forAnyWebSocket().thenPassThrough();

        // Not currently needed
        //this.handleWebsocketMessageReceived();

        this.handleWebsocketMessageSent();


        this.server.on('request', (req) => this.handleRequests(req));
        this.server.on('response', (res) => this.handleResponses(res))

        await this.server.start();
        console.log("MVS Proxy Started");
    }

    async handleResponses(res: mockttp.CompletedResponse) {
        const item = this.httpCollection.item.find(item => item.id === res.id);
        if (item) {
            const responseBody = ((await this.getBodyType(res, res.body.buffer)).raw as string);
            if (item.name === "/batch") {
                const requestBodyParse = JSON.parse(item.request.body.raw as string) as HydraBatchRequest;
                const responseBodyParse = JSON.parse(responseBody) as HydraBatchResponse;
                for (let i = 0; i < requestBodyParse.requests.length; i++) {
                    const id = crypto.randomUUID();
                    const request = requestBodyParse.requests[i];
                    const response = responseBodyParse.responses[i];

                    let fullu = `https://${item.request.url.host.join(".")}${request.url}`;
                    let url = new URL(fullu);
                    this.httpCollection.item.push({
                        id: id,
                        name: url.pathname,
                        request: {
                            header: Object.keys(request.headers).map((key) => { return { key: key, value: request.headers[key] as string } }),
                            method: request.verb,
                            body: {
                                mode: "raw",
                                raw: JSON.stringify(request.body, null, 2),
                                options: {
                                    raw: {
                                        language: "json"
                                    }
                                }
                            },
                            description: "Parsed from batch request",
                            url: {
                                host: item.request.url.host,
                                protocol: item.request.url.protocol,
                                path: url.pathname.split("/").slice(1),
                                query: url.search ? Array.from(url.searchParams.entries()).map(query => { return { key: query[0], value: query[1] } }) : undefined,

                            }
                        },
                        response: [
                            {
                                name: request.url,
                                _postman_previewlanguage: "json",
                                body: JSON.stringify(response.body, null, 2),
                                code: response.status_code,
                                header: Object.keys(response.headers).map((key) => { return { key: key, value: response.headers[key] as string } }),
                                status: "",

                            }
                        ]
                    })
                }
            }
            item.response = [
                {
                    name: item.name,
                    _postman_previewlanguage: "json",
                    body: responseBody,
                    code: res.statusCode,
                    header: Object.keys(res.headers).map((key) => { return { key: key, value: res.headers[key] as string } }),
                    status: res.statusMessage,
                    originalRequest: {
                        body: {
                            mode: "raw",
                            raw: res.body.buffer.toString("hex"),
                            options: {
                                raw: {
                                    language: "text"
                                }
                            }
                        },
                        header: [],
                        method: item.request.method,
                        url: item.request.url,
                    }


                }
            ]
        }
    }

    async handleRequests(req: mockttp.CompletedRequest) {
        if (req.hostname === 'localhost') {
            return;
        }
        if (this.hostnames.includes(req.headers.host!)) {
            let fullu = `${req.protocol}://${req.headers.host}${req.path}`;
            let url = new URL(fullu);
            let buffer = req.body.buffer;
            this.httpCollection.item.push({
                id: req.id,
                name: url.pathname,
                request: {
                    header: Object.keys(req.headers).map((key) => { return { key: key, value: req.headers[key] as string } }),
                    method: req.method,
                    body: await this.getBodyType(req, buffer),
                    description: buffer.toString("hex"),
                    url: {
                        host: url.hostname.split('.'),
                        protocol: req.protocol,
                        path: url.pathname.split("/").slice(1),
                        query: url.search ? Array.from(url.searchParams.entries()).map(query => { return { key: query[0], value: query[1] } }) : undefined,

                    }
                },
            })

        }
    }


    handleWebsocketMessageReceived() {
        this.server.on('websocket-message-received', async (req) => {
            try {
                let typeNum = Buffer.from(req.content.data).readUInt8();
                if (typeNum === 6) {
                    let slice = req.content.data.slice(3);
                    const message = new HydraDecoder(Buffer.from(slice)).readValue();
                }
            } catch (e) {
                console.log("Error on websocket-message-received:", e);
            }

        })
    }

    handleWebsocketMessageSent() {
        this.server.on('websocket-message-sent', async (req) => {
            try {
                const buffer = Buffer.from(req.content.data);
                let typeNum = buffer.readUInt8();
                if (typeNum === 6) {
                    let slice = req.content.data.slice(3);
                    const message = new HydraDecoder(Buffer.from(slice)).readValue() as Object;
                    this.websocketCollection.item.push(
                        {
                            name: `${message["cmd"] || ""}-${req.direction}`,
                            request: {
                                header: [],
                                method: "POST",
                                body: {
                                    mode: 'raw',
                                    options: {
                                        raw: {
                                            language: "json"
                                        }
                                    },
                                    raw: JSON.stringify(message, null, 2),

                                },
                                description: buffer.toString("hex"),
                                url: {
                                    host: [req.ws.upstreamWebSocket.url],
                                    protocol: "",
                                    path: [],

                                }
                            },
                        }
                    )
                }

            } catch (e) {
                console.log("Error on websocket-message-sent:", e);
            }

        });
    }

    async getBodyType(req_res: mockttp.CompletedRequest | mockttp.CompletedResponse, buffer: Buffer): Promise<Body> {

        switch (req_res.headers['content-type']) {
            case "application/x-www-form-urlencoded": {
                return {
                    mode: "raw",
                    raw: buffer.toString("utf-8"),
                    options: {
                        raw: {
                            language: "text"
                        }
                    }
                }
            }
            case "application/json": {
                return {
                    mode: "raw",
                    raw: JSON.stringify(JSON.parse(buffer.toString("utf-8") || "{}"), null, 2),
                    options: {
                        raw: {
                            language: "json"
                        }
                    }
                }
            }
            case "application/x-ag-binary": {
                return {
                    mode: "raw",
                    raw: JSON.stringify(new HydraDecoder(buffer).readValue(), null, 2),
                    options: {
                        raw: {
                            language: "json"
                        }
                    }
                }
            }
            default: {
                return {
                    mode: "raw",
                    raw: JSON.stringify(buffer.toString("utf-8")),
                    options: {
                        raw: {
                            language: "text"
                        }
                    }
                }
            }
        }
    }


}

const proxy = new Proxy();
export default proxy;
export interface PostmanCollection {
    info: Info
    item: Item[]
}

export interface Info {
    name: string
    schema: string
}

export interface Item {
    id?: string
    name: string

    request: Request
    response?: Response[]
}



export interface Request {
    method: string
    header: Header[]
    body: Body
    url: Url
    description: string;
}

export interface Header {
    key: string
    value: string
}

export interface Body {
    mode: "urlencoded" | "raw"
    raw?: string
    urlencoded?: Header[],
    options?: Options
}

export interface Options {
    raw: Raw
}

export interface Raw {
    language: string
}

export interface Url {
    //raw: string
    protocol: string
    host: string[]
    query?: Query[]
    path: string[];
}

export interface Query {
    key: string
    value?: string
}

export interface Response {
    name: string
    originalRequest?: OriginalRequest
    status: string
    code: number
    _postman_previewlanguage: string
    header: Header3[]
    cookie?: any[]
    body: string
}

export interface OriginalRequest {
    method: string
    header: Header2[]
    body: Body2
    url: Url
}

export interface Header2 {
    key: string
    value: string
    type: string
    name?: string
}

export interface Body2 {
    mode: string
    raw: string
    options: Options2
}

export interface Options2 {
    raw: Raw2
}

export interface Raw2 {
    language: string
}

export interface Url2 {
    raw: string
    protocol: string
    host: string[]
    path: string[]
    query: Query2[]
}

export interface Query2 {
    key: string
    value?: string
}

export interface Header3 {
    key: string
    value: string
}

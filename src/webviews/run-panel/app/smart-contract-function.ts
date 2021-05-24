export enum SmartContractFunctionType {
    Execute = 'execute',
    Query = 'query'
}

export interface SmartContractFunctionProperty {
    name: string,
    type: string,
    required: boolean,
    items: string,
    properties: SmartContractFunctionProperty[]
}

export interface SmartContractFunction {
    name: string,
    type: SmartContractFunctionType,
    properties: SmartContractFunctionProperty[]
}

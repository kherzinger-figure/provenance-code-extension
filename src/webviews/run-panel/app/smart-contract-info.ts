export interface SmartContractInfo {
    name: string,
    address: string,
    codeId: number
}

export const EmptySmartContractInfo: SmartContractInfo = {
    name: '',
    address: '',
    codeId: 0
};

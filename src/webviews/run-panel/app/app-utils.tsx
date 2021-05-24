import { RunViewAppBinding } from './app-binding';
import { SmartContractFunction, SmartContractFunctionType } from "./smart-contract-function";

export default class Utils {

    static snakeToCamel (snakeCaseString: string) {
        return snakeCaseString.replace(/([-_]\w)/g, g => g[1].toUpperCase());
    }

    static snakeToTitle (snakeCaseString: string) {
        const camel = Utils.snakeToCamel(snakeCaseString);
        return camel.charAt(0).toUpperCase() + camel.slice(1);
    }

    static runFunction (func: SmartContractFunction, args: any): Promise<any> {
        switch (func.type) {
            case SmartContractFunctionType.Execute: {
                return Utils.execute(func, args);
            }

            case SmartContractFunctionType.Query: {
                return Utils.query(func, args);
            }

            default: {
                return new Promise<any>((resolve, reject) => {
                    reject(new Error('Invalid smart contract function type'));
                });
            }
        }
    }

    static execute (func: SmartContractFunction, args: any): Promise<any> {
        const appBinding: RunViewAppBinding = RunViewAppBinding.getReactInstance();
        return appBinding.executeFunction(func, args);
    }

    static query (func: SmartContractFunction, args: any): Promise<any> {
        const appBinding: RunViewAppBinding = RunViewAppBinding.getReactInstance();
        return appBinding.queryFunction(func, args);
    }

}

import { extensionConfigType } from "../coreInterfaces";
export declare function matchModuleToUrl(config: extensionConfigType, currentUrl: string): {
    functionalities: import("../coreInterfaces").Constructor<import("../coreInterfaces").Module>[];
};
export declare function checkUrl(url: string, currentUrl: string): boolean;
export declare function getCurrentUrl(): string;
export declare function replacer(pathname: string): string;

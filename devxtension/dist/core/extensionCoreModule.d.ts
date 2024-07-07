import { extensionConfigType, Module } from "./coreInterfaces";
export declare class ExtensionCoreModule implements Module {
    private modules;
    constructor(config: extensionConfigType);
    setup(): void;
    reSetup(config: extensionConfigType): void;
    private putModules;
}

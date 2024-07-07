import { extensionConfigType, Module, Target, ModuleTurnerType, changeTurnEventsType } from '../coreInterfaces';
export declare class ModuleTurner implements ModuleTurnerType {
    private readonly changeTurnEvents;
    private currentElement;
    private extension;
    private config;
    private Config;
    constructor();
    initialModuleTurner(extension: Module, config: extensionConfigType, Config: Target): void;
    registerTurnHandle({ turnHandle, elementID, browserEvent }: changeTurnEventsType): void;
    get getTurnEvents(): changeTurnEventsType[];
    private reselectModules;
}

export interface GeneralServiceInterface {
  // for future implements
}

export interface Module {
    setup?(): void // here we indicated the point of start the module
    reSetup?(config: extensionConfigType): void // change module according to new URL
}

export interface extensionConfigType {
    functionalities: Constructor<Module>[]
}

export type ServiceModuleRecord<T> = Record<string, T[keyof T]>

interface ModuleOptions {
  name: string
  url: string
  setupFunction: () => void
}

export interface ModuleDecoratorOptions<T> extends ModuleOptions {
  mainService: T[keyof T]
  services: ServiceModuleRecord<T>
  executors?: [T[keyof T], () => void][]
}

export interface ModuleDecoratorOptionsAdapt<T> extends ModuleOptions {
  mainService: T[keyof T]
  services: ServiceModuleRecord<T>
  executors?: (() => void)[]
}

export type Constructor<T> = new (services?: Object) => T

export interface Target {
    config: extensionConfigType
    setConfig(config: extensionConfigType): void
    getConfig(): extensionConfigType
}

export type DisableFeaturesDecoratorType<T, C> = {
  method: (...args: any) => any,
  features: T[keyof T] | null,
  link: C
}

export interface ModuleTurnerType {
  registerTurnHandle(event: changeTurnEventsType): void
  initialModuleTurner(extension: Module, config: extensionConfigType, Config: Target): void
}

export type changeTurnEventsType = {
  turnHandle?: () => void
  browserEvent: 'keyup' | 'mouseup'
  elementID: string
}

declare class DependencyContainer {
    private services;
    constructor();
    registerService<T extends new (...args: any[]) => {}>(key: string, service: T): void;
    getService<T>(key: string): T;
}
declare const dependencyContainer: DependencyContainer;
export { dependencyContainer };

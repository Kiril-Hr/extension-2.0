import {
    ExecutorsDecoratorOutputArray, ExecutorsProviderInput,
    Instance,
    MainServiceType,
    ModuleDecoratorOptionsInput,
    ModuleDecoratorOptionsOutput,
    WidgetModuleArrayOutput, SingleExecutorsProviderInput, SingleExecutorType, WidgetValue
} from "../coreInterfaces";
import {dependencyContainer} from "../dependencyContainer/dependencyContainer";

export function checkModuleDecoratorParams(params: ModuleDecoratorOptionsOutput, moduleName: string): ModuleDecoratorOptionsInput {
    if (!params.url) throw new Error('You have not specified url')
    if (params.reactiveScripts && params.vanilla) throw new Error('Specify either vanilla or reactiveScripts, not both')

    let newParams: ModuleDecoratorOptionsInput = { url: '' }

    if (params.widgets) {
        newParams.widgets = validWidgetsArray(params.widgets)
    }

    if (params.vanilla) {
        const mainService = typeof params.vanilla.mainService === 'function'
            ? dependencyContainer.getService<MainServiceType>(params.vanilla.mainService.name)
            : params.vanilla.mainService

        const setupFunction = mainService.run

        const executors = Array.isArray(params.vanilla.executors)
            ? executorsArray(params.vanilla.executors as ExecutorsDecoratorOutputArray)
            : executorService(params.vanilla.executors as SingleExecutorType)

        newParams = {
            ...params,
            name: moduleName,
            widgets: newParams.widgets ?? undefined,
            vanilla: {
                mainService,
                setupFunction,
                executors
            }
        }
    }

    if (params.reactiveScripts && !params.vanilla) {
        const pseudoUniqueID = Math.ceil(Math.random() * 1000)
        const name = params.name ? params.name : params.url + '_' + pseudoUniqueID

        newParams = {
            url: params.url,
            name,
            widgets: newParams.widgets,
            reactiveScripts: params.reactiveScripts
        }
    }

    return newParams
}

function executorsArray(executors: ExecutorsDecoratorOutputArray) {
    if (!executors || executors.length === 0) return []
    return executors.map((s) => {
        const service = dependencyContainer.getService<SingleExecutorType>(s.name)
        return [service, service.executor] as SingleExecutorsProviderInput;
    })
}

function executorService(service: Instance) {
    if (!service) return []
    const executors: ExecutorsProviderInput = [];

    const executorService = dependencyContainer.getService(service.name);
    const servicePrototype = Object.getPrototypeOf(executorService);
    const methodNames = Object.getOwnPropertyNames(servicePrototype);

    for (const methodName of methodNames) {
        const method = servicePrototype[methodName];
        if (methodName !== 'constructor' && typeof method === "function") {
            const executorArray = [executorService, method] as SingleExecutorsProviderInput;
            executors.push(executorArray);
        }
    }

    return executors;
}

function validWidgetsArray(widgets: WidgetModuleArrayOutput) {
    return widgets.map((widget) => {
        try {
            if (widget.name) {
                return checkWidget(widget)
            } else {
                const pseudoUniqueID = Math.ceil(Math.random() * 1000)
                Object.defineProperty(widget, 'name', { value: 'widget_' + pseudoUniqueID })

                return checkWidget(widget)
            }
        } catch (e) {
            throw new Error('Error during validation widgets', { cause: e })
        }
    })
}

function checkWidget(widget: WidgetValue) {
    const widgetValid = dependencyContainer.checkService(widget.name)
    if (!widgetValid) {
        dependencyContainer.registerService(widget.name, widget)
    }

    const Widget = dependencyContainer.getService<WidgetValue>(widget.name)

    if (typeof Widget.setup !== 'function') throw new Error(`Widget "${widget.name}" must implement setup()`)
    return () => {
        dependencyContainer.acquireSharedModule(Widget)
        return () => dependencyContainer.releaseSharedModule(Widget)
    }
}

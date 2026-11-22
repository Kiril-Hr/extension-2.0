import { implementReactComponents } from "./components/ReactComponent";

export class ReactiveComponentFactory {
    static createComponent({ components, type }): (() => void) | undefined {
        switch(type) {
            case 'react':
                return implementReactComponents(components);
            default:
                console.warn('Specify your reactive component');
                return undefined;
        }
    }
}

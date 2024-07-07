import { implementReactComponents } from "./components/ReactComponent";

export class ReactiveComponentFactory {
    static createComponent({ components, type }) {
        switch(type) {
            case 'react':
                return implementReactComponents(components);
            default:
                return console.warn('Specify your reactive component')
        }
    }
}

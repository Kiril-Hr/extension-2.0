"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModuleTurner = void 0;
const ServiceDecorator_1 = require("../decorators/ServiceDecorator");
const checkURL_utils_1 = require("../commonUtils/checkURL.utils");
let ModuleTurner = exports.ModuleTurner = class ModuleTurner {
    constructor() {
        this.changeTurnEvents = [];
    }
    initialModuleTurner(extension, config, Config) {
        this.extension = extension;
        this.config = config;
        this.Config = Config;
    }
    registerTurnHandle({ turnHandle, elementID, browserEvent }) {
        this.changeTurnEvents.push({ turnHandle, elementID, browserEvent });
        document.body.addEventListener(browserEvent, (e) => {
            console.log(e.target.id);
            if (e.target.id === elementID) {
                setTimeout(() => {
                    this.reselectModules();
                    if (turnHandle)
                        turnHandle();
                    this.currentElement = e.target;
                }, 1000);
            }
        });
    }
    get getTurnEvents() {
        return [...this.changeTurnEvents];
    }
    reselectModules() {
        const currentURL = new URL((0, checkURL_utils_1.getCurrentUrl)());
        this.config = (0, checkURL_utils_1.matchModuleToUrl)(this.config, currentURL.href);
        this.Config.setConfig(this.config);
        this.extension.reSetup(this.Config.getConfig());
    }
};
exports.ModuleTurner = ModuleTurner = __decorate([
    ServiceDecorator_1.ServiceDecorator,
    __metadata("design:paramtypes", [])
], ModuleTurner);
//# sourceMappingURL=ModuleTurner.js.map
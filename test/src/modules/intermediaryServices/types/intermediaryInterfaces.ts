import { GeneralServiceInterface } from 'devxtension/dist/core/coreInterfaces';
import { RulesType } from './intermediaryTypes';

export interface RulesIntermediaryInterface extends GeneralServiceInterface {
   getRules(): Promise<RulesType>;
}

export interface FetchFilesInterface extends GeneralServiceInterface {
  getMicroAudio(name: string): Promise<{ microAudio: Blob }>
}

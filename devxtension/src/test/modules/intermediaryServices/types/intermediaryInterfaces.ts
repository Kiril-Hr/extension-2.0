import { GeneralServiceInterface } from '../../../../core';
import { RulesType } from './intermediaryTypes';

export interface RulesIntermediaryInterface extends GeneralServiceInterface {
   getRules(): Promise<RulesType>;
}

export interface FetchFilesInterface extends GeneralServiceInterface {
  getMicroAudio(name: string): Promise<{ microAudio: Blob }>
}

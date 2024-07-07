import { RulesIntermediaryInterface } from '../types/intermediaryInterfaces';
import mockRules from '../../../../config.json';

export class RulesIntermediaryService implements RulesIntermediaryInterface {
   constructor() {}

   public async getRules() {
      try {
        return await this.fetchServerRules() || {}
      } catch (e) {
        return mockRules;
      }
   }

   public async fetchServerRules() {
      try {
         const response = await fetch(`${process.env.DB_HOST}/rules`);
         if (!response.ok) {
            throw new Error('Request failed with status: ' + response.status);
         }

         const data = await response.json();
         return JSON.parse(data);
      } catch (error) {
         console.error('Error fetching data:', error);
      }
   }

}

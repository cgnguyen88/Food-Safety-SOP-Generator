import { FarmWaterSourcesContext, useLoadWaterSources } from './farmWaterSources.js';

/** Loads a farm's list of water sources once and shares it with every records screen below (the forms, the water page, a record's detail). */
export default function FarmWaterSourcesProvider({ farmId, children }) {
  const value = useLoadWaterSources(farmId);
  return <FarmWaterSourcesContext.Provider value={value}>{children}</FarmWaterSourcesContext.Provider>;
}

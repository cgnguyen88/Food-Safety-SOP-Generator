import { LotCodeSettingsContext, lotCodeSettingsFor } from './lotCodeSettings.js';
import FarmFieldsProvider from './FarmFieldsProvider.jsx';

/**
 * What the record forms need from the farm, shared by every screen that can add a record: the farm's field list
 * (for the field picker) and the lot code format (for the harvest form).
 */
export default function RecordsProviders({ farm, lotCodeFormat, children }) {
  return (
    <LotCodeSettingsContext.Provider value={lotCodeSettingsFor({ lotCodeFormat, farm })}>
      <FarmFieldsProvider farmId={farm.id}>{children}</FarmFieldsProvider>
    </LotCodeSettingsContext.Provider>
  );
}

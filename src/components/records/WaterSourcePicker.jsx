import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { recordsText } from './text.js';
import FieldPicker from './FieldPicker.jsx';

/**
 * The "water source" box of a record form, when the farm has a list of water sources: pick one, or "Other" and type a name
 * that is not on the list yet. Works like the field picker: a record can keep an archived source it already has, and a name
 * that is not on the list is shown typed in.
 *
 * @param {Omit<import('react').ComponentProps<typeof FieldPicker>, 'fields' | 'text'> & { sources: Array<{ name: string, is_active: boolean }> }} props
 */
export default function WaterSourcePicker({ sources, ...props }) {
  const { lang: rawLang } = useLanguage();
  return <FieldPicker {...props} fields={sources} text={recordsText(rawLang === 'es' ? 'es' : 'en').water.choice} />;
}

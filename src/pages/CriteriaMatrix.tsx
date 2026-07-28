import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CRITERIA, getCategories } from '../data/criteria';

export default function CriteriaMatrix() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  const categories = getCategories();

  const filtered = useMemo(
    () =>
      CRITERIA.filter((c) => {
        const matchesSearch =
          !search ||
          c.criterion.toLowerCase().includes(search.toLowerCase()) ||
          c.subcategory.toLowerCase().includes(search.toLowerCase()) ||
          c.source.toLowerCase().includes(search.toLowerCase());
        const matchesCat = !filterCategory || c.category === filterCategory;
        return matchesSearch && matchesCat;
      }),
    [search, filterCategory]
  );

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">{t('criteria.title')}</h2>
        <p className="text-sm text-gray-500 mt-1">{t('criteria.description')}</p>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('common.search')}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm flex-1 min-w-[200px]"
        />
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="">{t('common.all')} — {t('criteria.category')}</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>{t(`categories.${cat}`, cat)}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left py-3 px-4 text-gray-500 font-medium w-16">{t('criteria.id')}</th>
              <th className="text-left py-3 px-4 text-gray-500 font-medium">{t('criteria.category')}</th>
              <th className="text-left py-3 px-4 text-gray-500 font-medium">{t('criteria.subcategory')}</th>
              <th className="text-left py-3 px-4 text-gray-500 font-medium">{t('criteria.criterion')}</th>
              <th className="text-left py-3 px-4 text-gray-500 font-medium">{t('criteria.source')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4 text-gray-400 font-mono">{c.id}</td>
                <td className="py-3 px-4">
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-brand-100 text-brand-700">
                    {t(`categories.${c.category}`, c.category)}
                  </span>
                </td>
                <td className="py-3 px-4 text-gray-700">{t(`subcategories.${c.subcategory}`, c.subcategory)}</td>
                <td className="py-3 px-4 text-gray-900">{c.criterion}</td>
                <td className="py-3 px-4 text-gray-500 text-xs font-mono">{c.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400">{t('common.noResults')}</div>
        )}
      </div>

      <div className="mt-4 text-sm text-gray-400 text-right">
        {t('criteria.id')}: {filtered.length} / {CRITERIA.length}
      </div>
    </div>
  );
}

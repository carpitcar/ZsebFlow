import type { CSSProperties } from 'react'

export type CategoryFilterOption = {
  id: string
  name: string
  color: string
}

type CategoryFilterBarProps = {
  categories: CategoryFilterOption[]
  activeCategoryId: string | null
  onChange: (categoryId: string | null) => void
}

export function CategoryFilterBar({
  categories,
  activeCategoryId,
  onChange,
}: CategoryFilterBarProps) {
  if (categories.length === 0) {
    return null
  }

  return (
    <div className="category-filter-bar" aria-label="Kategória szűrő">
      <button
        className={activeCategoryId === null ? 'active all' : 'all'}
        type="button"
        aria-label="Összes kategória"
        aria-pressed={activeCategoryId === null}
        onClick={() => onChange(null)}
      />
      {categories.map((category) => (
        <button
          key={category.id}
          className={activeCategoryId === category.id ? 'active' : ''}
          type="button"
          aria-label={`${category.name} kategória szűrése`}
          aria-pressed={activeCategoryId === category.id}
          style={
            {
              '--category-color': category.color,
              backgroundColor: category.color,
            } as CSSProperties
          }
          onClick={() =>
            onChange(activeCategoryId === category.id ? null : category.id)
          }
        />
      ))}
    </div>
  )
}

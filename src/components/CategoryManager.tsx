import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Category, TransactionType } from '../types/finance'

type Message = {
  type: 'success' | 'error'
  text: string
}

type CategoryWithCount = Category & {
  transactionCount: number
}

type CategoryManagerProps = {
  userId: string
}

const categoryTypeLabels: Record<TransactionType, string> = {
  expense: 'Kiadás',
  income: 'Bevétel',
}

const normalizeName = (name: string) => name.trim().toLocaleLowerCase('hu-HU')

export function CategoryManager({ userId }: CategoryManagerProps) {
  const [categories, setCategories] = useState<CategoryWithCount[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState('')
  const [newType, setNewType] = useState<TransactionType>('expense')
  const [editName, setEditName] = useState('')
  const [editIcon, setEditIcon] = useState('')
  const [message, setMessage] = useState<Message | null>(null)

  const loadCategories = useCallback(async () => {
    setIsLoading(true)
    setMessage(null)

    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', userId)
      .order('type', { ascending: true })
      .order('name', { ascending: true })

    if (error) {
      setMessage({
        type: 'error',
        text: `Nem sikerült betölteni a kategóriákat: ${error.message}`,
      })
      setCategories([])
      setIsLoading(false)
      return
    }

    const categoryRows = (data ?? []) as Category[]
    const categoriesWithCounts = await Promise.all(
      categoryRows.map(async (category) => {
        const { count, error: countError } = await supabase
          .from('transactions')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('category_id', category.id)

        return {
          ...category,
          transactionCount: countError ? 0 : count ?? 0,
        }
      }),
    )

    setCategories(categoriesWithCounts)
    setIsLoading(false)
  }, [userId])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadCategories()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadCategories])

  const expenseCategories = useMemo(
    () => categories.filter((category) => category.type === 'expense'),
    [categories],
  )
  const incomeCategories = useMemo(
    () => categories.filter((category) => category.type === 'income'),
    [categories],
  )

  const hasDuplicate = (
    name: string,
    type: TransactionType,
    ignoredCategoryId?: string,
  ) =>
    categories.some(
      (category) =>
        category.id !== ignoredCategoryId &&
        category.type === type &&
        normalizeName(category.name) === normalizeName(name),
    )

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage(null)

    const name = newName.trim()
    const icon = newIcon.trim()

    if (!name) {
      setMessage({
        type: 'error',
        text: 'A kategória neve kötelező.',
      })
      return
    }

    if (hasDuplicate(name, newType)) {
      setMessage({
        type: 'error',
        text: 'Már létezik ilyen nevű kategória.',
      })
      return
    }

    setIsSaving(true)

    const { error } = await supabase.from('categories').insert({
      user_id: userId,
      name,
      type: newType,
      icon: icon || null,
    })

    if (error) {
      setMessage({
        type: 'error',
        text: `Nem sikerült létrehozni a kategóriát: ${error.message}`,
      })
      setIsSaving(false)
      return
    }

    setNewName('')
    setNewIcon('')
    await loadCategories()
    setMessage({
      type: 'success',
      text: 'A kategória létrejött.',
    })
    setIsSaving(false)
  }

  const startEditing = (category: CategoryWithCount) => {
    setEditingId(category.id)
    setEditName(category.name)
    setEditIcon(category.icon ?? '')
    setMessage(null)
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditName('')
    setEditIcon('')
  }

  const handleRename = async (category: CategoryWithCount) => {
    setMessage(null)

    const name = editName.trim()
    const icon = editIcon.trim()

    if (!name) {
      setMessage({
        type: 'error',
        text: 'A kategória neve kötelező.',
      })
      return
    }

    if (hasDuplicate(name, category.type, category.id)) {
      setMessage({
        type: 'error',
        text: 'Már létezik ilyen nevű kategória.',
      })
      return
    }

    setIsSaving(true)

    const { error } = await supabase
      .from('categories')
      .update({
        name,
        icon: icon || null,
      })
      .eq('id', category.id)
      .eq('user_id', userId)

    if (error) {
      setMessage({
        type: 'error',
        text: `Nem sikerült módosítani a kategóriát: ${error.message}`,
      })
      setIsSaving(false)
      return
    }

    cancelEditing()
    await loadCategories()
    setMessage({
      type: 'success',
      text: 'A kategória módosítása sikerült.',
    })
    setIsSaving(false)
  }

  const handleDelete = async (category: CategoryWithCount) => {
    setMessage(null)

    const { count, error: countError } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('category_id', category.id)

    if (countError) {
      setMessage({
        type: 'error',
        text: `Nem sikerült ellenőrizni a kategóriát: ${countError.message}`,
      })
      return
    }

    if ((count ?? 0) > 0) {
      setMessage({
        type: 'error',
        text: 'A kategória nem törölhető, mert tranzakciók tartoznak hozzá. Előbb kategorizáld át ezeket a tételeket.',
      })
      return
    }

    const isConfirmed = window.confirm(
      `Biztosan törlöd ezt a kategóriát: ${category.name}?`,
    )

    if (!isConfirmed) {
      return
    }

    setIsSaving(true)

    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', category.id)
      .eq('user_id', userId)

    if (error) {
      setMessage({
        type: 'error',
        text: `Nem sikerült törölni a kategóriát: ${error.message}`,
      })
      setIsSaving(false)
      return
    }

    await loadCategories()
    setMessage({
      type: 'success',
      text: 'A kategória törölve.',
    })
    setIsSaving(false)
  }

  const renderCategoryList = (
    title: string,
    categoryRows: CategoryWithCount[],
  ) => (
    <div className="category-group">
      <h3>{title}</h3>
      {categoryRows.length === 0 ? (
        <p className="empty-state">Még nincs ilyen típusú kategória.</p>
      ) : (
        <div className="category-list">
          {categoryRows.map((category) => {
            const isEditing = editingId === category.id

            return (
              <article className="category-item" key={category.id}>
                {isEditing ? (
                  <div className="category-edit-grid">
                    <label htmlFor={`categoryIcon-${category.id}`}>
                      Ikon
                      <input
                        id={`categoryIcon-${category.id}`}
                        type="text"
                        value={editIcon}
                        onChange={(event) => setEditIcon(event.target.value)}
                        disabled={isSaving}
                      />
                    </label>
                    <label htmlFor={`categoryName-${category.id}`}>
                      Név
                      <input
                        id={`categoryName-${category.id}`}
                        type="text"
                        value={editName}
                        onChange={(event) => setEditName(event.target.value)}
                        disabled={isSaving}
                        required
                      />
                    </label>
                    <div className="category-actions">
                      <button
                        className="primary-button"
                        type="button"
                        onClick={() => void handleRename(category)}
                        disabled={isSaving}
                      >
                        Mentés
                      </button>
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={cancelEditing}
                        disabled={isSaving}
                      >
                        Mégse
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="category-main">
                      <span className="category-icon-large" aria-hidden="true">
                        {category.icon || '•'}
                      </span>
                      <div>
                        <strong>{category.name}</strong>
                        <span>
                          {categoryTypeLabels[category.type]} ·{' '}
                          {category.transactionCount} tranzakció
                        </span>
                      </div>
                    </div>
                    <div className="category-actions">
                      <button
                        className="secondary-button compact-button"
                        type="button"
                        onClick={() => startEditing(category)}
                        disabled={isSaving}
                      >
                        Szerkesztés
                      </button>
                      <button
                        className="secondary-button compact-button danger-button"
                        type="button"
                        onClick={() => void handleDelete(category)}
                        disabled={isSaving}
                      >
                        Törlés
                      </button>
                    </div>
                  </>
                )}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )

  return (
    <section className="settings-section category-manager">
      <div>
        <h2>Kategóriák</h2>
        <p className="subtle-text">
          A kategóriák módosítása a meglévő tranzakciók megjelenését is
          frissíti.
        </p>
      </div>

      <form className="category-form" onSubmit={handleCreate}>
        <label htmlFor="newCategoryName">
          Kategória neve
          <input
            id="newCategoryName"
            type="text"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            disabled={isSaving}
            required
          />
        </label>
        <label htmlFor="newCategoryIcon">
          Ikon vagy emoji
          <input
            id="newCategoryIcon"
            type="text"
            value={newIcon}
            onChange={(event) => setNewIcon(event.target.value)}
            disabled={isSaving}
          />
        </label>
        <label htmlFor="newCategoryType">
          Típus
          <select
            id="newCategoryType"
            value={newType}
            onChange={(event) =>
              setNewType(event.target.value as TransactionType)
            }
            disabled={isSaving}
          >
            <option value="expense">Kiadás</option>
            <option value="income">Bevétel</option>
          </select>
        </label>
        <button className="primary-button" type="submit" disabled={isSaving}>
          {isSaving ? 'Mentés...' : 'Kategória létrehozása'}
        </button>
      </form>

      {message ? (
        <p className={`message ${message.type}`} role="status">
          {message.text}
        </p>
      ) : null}

      {isLoading ? (
        <p className="empty-state">Kategóriák betöltése...</p>
      ) : (
        <>
          {renderCategoryList('Kiadási kategóriák', expenseCategories)}
          {renderCategoryList('Bevételi kategóriák', incomeCategories)}
        </>
      )}
    </section>
  )
}

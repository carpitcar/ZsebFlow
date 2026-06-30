import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { FormEvent } from 'react'
import {
  archiveList,
  createList,
  createListItem,
  deleteList,
  deleteListItem,
  loadLists,
  toggleListItemCompleted,
  unarchiveList,
  updateList,
  updateListItem,
} from '../lib/lists'
import { formatCompactDate, formatHungarianDate } from '../lib/date'
import type {
  ListItem,
  ListPriority,
  ListType,
  ListWithItems,
} from '../types/lists'
import { BrandHeader } from './BrandHeader'
import { MobileBottomNav } from './MobileBottomNav'

type ListsViewProps = {
  userId: string
  onOpenHome: () => void
  onOpenReports: () => void
  onOpenProfile: () => void
  onAddTransaction: () => void
}

type ListTab = 'active' | 'completed' | 'archived'
type Message = { type: 'success' | 'error'; text: string }

const listTypeLabels: Record<ListType, string> = {
  shopping: 'Bevásárlás',
  tasks: 'Teendők',
  reminder: 'Emlékeztető',
  custom: 'Egyéni',
}

const listTypeDefaults: Record<ListType, { icon: string; color: string }> = {
  shopping: { icon: '🛒', color: '#14b8a6' },
  tasks: { icon: '✓', color: '#3b82f6' },
  reminder: { icon: '⏰', color: '#f97316' },
  custom: { icon: '☰', color: '#8b5cf6' },
}

const priorityLabels: Record<ListPriority, string> = {
  low: 'Alacsony',
  normal: 'Normál',
  high: 'Magas',
}

const defaultShoppingUnit = 'db'

const commonShoppingUnits = ['db', 'kg', 'g', 'l', 'ml', 'csomag', 'üveg', 'doboz']

const getCompletion = (items: ListItem[]) => {
  const completed = items.filter((item) => item.is_completed).length
  const total = items.length
  return {
    completed,
    total,
    percentage: total === 0 ? 0 : Math.round((completed / total) * 100),
  }
}

const isCompletedList = (list: ListWithItems) =>
  !list.is_archived &&
  list.items.length > 0 &&
  list.items.every((item) => item.is_completed)

const isActiveList = (list: ListWithItems) =>
  !list.is_archived && !isCompletedList(list)

const isPastDate = (dateValue: string | null) =>
  Boolean(dateValue && dateValue < new Date().toISOString().slice(0, 10))

const getDueState = (dateValue: string | null) => {
  if (!dateValue) {
    return ''
  }

  return isPastDate(dateValue) ? 'Lejárt' : 'Esedékes'
}

const parseOptionalQuantity = (quantity: string) => {
  const trimmedQuantity = quantity.trim()

  if (!trimmedQuantity) {
    return null
  }

  const parsedQuantity = Number(trimmedQuantity.replace(',', '.'))
  return Number.isFinite(parsedQuantity) ? parsedQuantity : Number.NaN
}

const formatItemQuantity = (quantity: ListItem['quantity'], unit: string | null) => {
  if (quantity == null || String(quantity).trim() === '') {
    return ''
  }

  const parsedQuantity = Number(String(quantity))
  const quantityLabel = Number.isFinite(parsedQuantity)
    ? parsedQuantity.toString()
    : String(quantity)
  const unitLabel = unit?.trim()

  return unitLabel ? `${quantityLabel} ${unitLabel}` : quantityLabel
}

export function ListsView({
  userId,
  onOpenHome,
  onOpenReports,
  onOpenProfile,
  onAddTransaction,
}: ListsViewProps) {
  const loadRequestRef = useRef(0)
  const createListLockRef = useRef(false)
  const createItemLockRef = useRef(false)
  const [lists, setLists] = useState<ListWithItems[]>([])
  const [selectedListId, setSelectedListId] = useState<string | null>(null)
  const [editingItem, setEditingItem] = useState<ListItem | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isListEditOpen, setIsListEditOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<ListTab>('active')
  const [message, setMessage] = useState<Message | null>(null)
  const [newItemTitle, setNewItemTitle] = useState('')
  const [newShoppingItem, setNewShoppingItem] = useState({
    title: '',
    quantity: '',
    unit: defaultShoppingUnit,
  })
  const [listForm, setListForm] = useState({
    title: '',
    description: '',
    listType: 'shopping' as ListType,
    icon: listTypeDefaults.shopping.icon,
    color: listTypeDefaults.shopping.color,
    dueDate: '',
  })
  const [itemForm, setItemForm] = useState({
    title: '',
    notes: '',
    quantity: '',
    unit: '',
    dueAt: '',
    priority: 'normal' as ListPriority,
  })

  const selectedList = lists.find((list) => list.id === selectedListId) ?? null
  const isShoppingList = selectedList?.list_type === 'shopping'

  const filteredLists = useMemo(() => {
    if (activeTab === 'archived') {
      return lists.filter((list) => list.is_archived)
    }

    if (activeTab === 'completed') {
      return lists.filter(isCompletedList)
    }

    return lists.filter(isActiveList)
  }, [activeTab, lists])

  const loadData = useCallback(async () => {
    const requestId = ++loadRequestRef.current
    setIsLoading(true)
    setMessage(null)

    const { data, error } = await loadLists(userId)

    if (requestId !== loadRequestRef.current) {
      return
    }

    if (error) {
      setMessage({
        type: 'error',
        text: `Nem sikerült betölteni a listákat: ${error.message}`,
      })
      setLists([])
    } else {
      setLists(data)
    }

    setIsLoading(false)
  }, [userId])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadData()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadData])

  const updateLocalList = (updatedList: ListWithItems) => {
    setLists((currentLists) =>
      currentLists.map((list) => (list.id === updatedList.id ? updatedList : list)),
    )
  }

  const resetListForm = (listType: ListType = 'shopping') => {
    setListForm({
      title: '',
      description: '',
      listType,
      icon: listTypeDefaults[listType].icon,
      color: listTypeDefaults[listType].color,
      dueDate: '',
    })
  }

  const openListEdit = () => {
    if (!selectedList) {
      return
    }

    const listType = selectedList.list_type
    setListForm({
      title: selectedList.title,
      description: selectedList.description ?? '',
      listType,
      icon: selectedList.icon ?? listTypeDefaults[listType].icon,
      color: selectedList.color ?? listTypeDefaults[listType].color,
      dueDate: selectedList.due_date ?? '',
    })
    setIsListEditOpen(true)
  }

  const handleListTypeChange = (listType: ListType) => {
    setListForm((currentForm) => ({
      ...currentForm,
      listType,
      icon:
        currentForm.icon === listTypeDefaults[currentForm.listType].icon
          ? listTypeDefaults[listType].icon
          : currentForm.icon,
      color:
        currentForm.color === listTypeDefaults[currentForm.listType].color
          ? listTypeDefaults[listType].color
          : currentForm.color,
    }))
  }

  const handleCreateList = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (createListLockRef.current || isSaving) {
      return
    }

    const title = listForm.title.trim()
    if (!title) {
      setMessage({ type: 'error', text: 'Add meg a lista nevét.' })
      return
    }

    createListLockRef.current = true
    setIsSaving(true)
    const { data, error } = await createList({
      user_id: userId,
      title,
      description: listForm.description.trim() || null,
      list_type: listForm.listType,
      icon: listForm.icon.trim() || listTypeDefaults[listForm.listType].icon,
      color: listForm.color,
      due_date: listForm.dueDate || null,
    })

    if (error || !data) {
      setMessage({
        type: 'error',
        text: `Nem sikerült létrehozni a listát: ${error?.message ?? 'Ismeretlen hiba.'}`,
      })
    } else {
      setLists((currentLists) => [data, ...currentLists])
      setSelectedListId(data.id)
      setIsCreateOpen(false)
      resetListForm()
      setMessage(null)
    }

    setIsSaving(false)
    createListLockRef.current = false
  }

  const handleUpdateList = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedList || isSaving) {
      return
    }

    const title = listForm.title.trim()
    if (!title) {
      setMessage({ type: 'error', text: 'Add meg a lista nevét.' })
      return
    }

    setIsSaving(true)
    const { data, error } = await updateList(selectedList.id, {
      title,
      description: listForm.description.trim() || null,
      list_type: listForm.listType,
      icon: listForm.icon.trim() || listTypeDefaults[listForm.listType].icon,
      color: listForm.color,
      due_date: listForm.dueDate || null,
    })

    if (error || !data) {
      setMessage({
        type: 'error',
        text: `Nem sikerült módosítani a listát: ${error?.message ?? 'Ismeretlen hiba.'}`,
      })
    } else {
      updateLocalList(data)
      setIsListEditOpen(false)
    }

    setIsSaving(false)
  }

  const handleArchiveToggle = async () => {
    if (!selectedList || isSaving) {
      return
    }

    setIsSaving(true)
    const { data, error } = selectedList.is_archived
      ? await unarchiveList(selectedList.id)
      : await archiveList(selectedList.id)

    if (error || !data) {
      setMessage({
        type: 'error',
        text: `Nem sikerült módosítani az archiválást: ${error?.message ?? 'Ismeretlen hiba.'}`,
      })
    } else {
      updateLocalList(data)
    }
    setIsSaving(false)
  }

  const handleDeleteList = async () => {
    if (!selectedList || isSaving) {
      return
    }

    if (!window.confirm(`Biztosan törlöd ezt a listát: ${selectedList.title}?`)) {
      return
    }

    setIsSaving(true)
    const { error } = await deleteList(selectedList.id)
    if (error) {
      setMessage({
        type: 'error',
        text: `Nem sikerült törölni a listát: ${error.message}`,
      })
    } else {
      setLists((currentLists) =>
        currentLists.filter((list) => list.id !== selectedList.id),
      )
      setSelectedListId(null)
    }
    setIsSaving(false)
  }

  const handleCreateItem = async (event?: FormEvent) => {
    event?.preventDefault()
    if (!selectedList || createItemLockRef.current || isSaving) {
      return
    }

    const title = isShoppingList
      ? newShoppingItem.title.trim()
      : newItemTitle.trim()
    if (!title) {
      return
    }

    const quantity = isShoppingList
      ? parseOptionalQuantity(newShoppingItem.quantity)
      : null

    if (Number.isNaN(quantity) || (quantity != null && quantity < 0)) {
      setMessage({
        type: 'error',
        text: 'A mennyiség nem lehet negatív szám.',
      })
      return
    }

    createItemLockRef.current = true
    setIsSaving(true)
    const { data, error } = await createListItem({
      list_id: selectedList.id,
      title,
      ...(isShoppingList
        ? {
            quantity,
            unit: newShoppingItem.unit.trim() || null,
          }
        : {}),
      sort_order: selectedList.items.length,
    })

    if (error || !data) {
      setMessage({
        type: 'error',
        text: `Nem sikerült hozzáadni az elemet: ${error?.message ?? 'Ismeretlen hiba.'}`,
      })
    } else {
      updateLocalList({
        ...selectedList,
        items: [...selectedList.items, data],
      })
      if (isShoppingList) {
        setNewShoppingItem({
          title: '',
          quantity: '',
          unit: defaultShoppingUnit,
        })
      } else {
        setNewItemTitle('')
      }
    }
    setIsSaving(false)
    createItemLockRef.current = false
  }

  const handleToggleItem = async (item: ListItem) => {
    if (!selectedList) {
      return
    }

    const { data, error } = await toggleListItemCompleted(item)
    if (error || !data) {
      setMessage({
        type: 'error',
        text: `Nem sikerült módosítani az elemet: ${error?.message ?? 'Ismeretlen hiba.'}`,
      })
      return
    }

    updateLocalList({
      ...selectedList,
      items: selectedList.items.map((currentItem) =>
        currentItem.id === data.id ? data : currentItem,
      ),
    })
  }

  const openItemEdit = (item: ListItem) => {
    setEditingItem(item)
    setItemForm({
      title: item.title,
      notes: item.notes ?? '',
      quantity: item.quantity == null ? '' : String(item.quantity),
      unit: item.unit ?? '',
      dueAt: item.due_at ? item.due_at.slice(0, 16) : '',
      priority: item.priority,
    })
  }

  const handleUpdateItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedList || !editingItem || isSaving) {
      return
    }

    const title = itemForm.title.trim()
    if (!title) {
      setMessage({ type: 'error', text: 'Add meg az elem nevét.' })
      return
    }

    const quantity = parseOptionalQuantity(itemForm.quantity)
    if (Number.isNaN(quantity) || (quantity != null && quantity < 0)) {
      setMessage({
        type: 'error',
        text: 'A mennyiség nem lehet negatív szám.',
      })
      return
    }

    setIsSaving(true)
    const { data, error } = await updateListItem(
      editingItem.id,
      isShoppingList
        ? {
            title,
            quantity,
            unit: itemForm.unit.trim() || null,
          }
        : {
            title,
            notes: itemForm.notes.trim() || null,
            quantity,
            unit: itemForm.unit.trim() || null,
            due_at: itemForm.dueAt ? new Date(itemForm.dueAt).toISOString() : null,
            priority: itemForm.priority,
          },
    )

    if (error || !data) {
      setMessage({
        type: 'error',
        text: `Nem sikerült módosítani az elemet: ${error?.message ?? 'Ismeretlen hiba.'}`,
      })
    } else {
      updateLocalList({
        ...selectedList,
        items: selectedList.items.map((item) => (item.id === data.id ? data : item)),
      })
      setEditingItem(null)
    }
    setIsSaving(false)
  }

  const handleDeleteItem = async (item: ListItem) => {
    if (!selectedList) {
      return
    }

    if (!window.confirm(`Biztosan törlöd ezt az elemet: ${item.title}?`)) {
      return
    }

    const { error } = await deleteListItem(item.id)
    if (error) {
      setMessage({ type: 'error', text: `Nem sikerült törölni: ${error.message}` })
    } else {
      updateLocalList({
        ...selectedList,
        items: selectedList.items.filter((currentItem) => currentItem.id !== item.id),
      })
    }
  }

  const renderListForm = (
    title: string,
    onSubmit: (event: FormEvent<HTMLFormElement>) => void,
    onClose: () => void,
  ) => (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-panel list-sheet" role="dialog" aria-modal="true">
        <div className="panel-header">
          <h2>{title}</h2>
          <button
            className="secondary-button compact-button"
            type="button"
            onClick={onClose}
            disabled={isSaving}
          >
            Bezárás
          </button>
        </div>
        <form className="list-form" onSubmit={onSubmit}>
          <label htmlFor="listTitle">
            Lista neve
            <input
              id="listTitle"
              value={listForm.title}
              onChange={(event) =>
                setListForm((form) => ({ ...form, title: event.target.value }))
              }
              required
            />
          </label>
          <label htmlFor="listDescription">
            Leírás
            <textarea
              id="listDescription"
              value={listForm.description}
              onChange={(event) =>
                setListForm((form) => ({
                  ...form,
                  description: event.target.value,
                }))
              }
              rows={3}
            />
          </label>
          <label htmlFor="listType">
            Típus
            <select
              id="listType"
              value={listForm.listType}
              onChange={(event) => handleListTypeChange(event.target.value as ListType)}
            >
              {Object.entries(listTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <div className="list-form-row">
            <label htmlFor="listIcon">
              Ikon
              <input
                id="listIcon"
                value={listForm.icon}
                onChange={(event) =>
                  setListForm((form) => ({ ...form, icon: event.target.value }))
                }
                maxLength={3}
              />
            </label>
            <label htmlFor="listColor">
              Szín
              <input
                id="listColor"
                type="color"
                value={listForm.color}
                onChange={(event) =>
                  setListForm((form) => ({ ...form, color: event.target.value }))
                }
              />
            </label>
          </div>
          <label htmlFor="listDueDate">
            Határidő
            <input
              id="listDueDate"
              type="date"
              value={listForm.dueDate}
              onChange={(event) =>
                setListForm((form) => ({ ...form, dueDate: event.target.value }))
              }
            />
          </label>
          <button className="primary-button" type="submit" disabled={isSaving}>
            {isSaving ? 'Mentés...' : 'Mentés'}
          </button>
        </form>
      </section>
    </div>
  )

  if (selectedList) {
    const completion = getCompletion(selectedList.items)
    const openItems = selectedList.items.filter((item) => !item.is_completed)
    const completedItems = selectedList.items.filter((item) => item.is_completed)

    return (
      <main className="app-shell page-shell">
        <section className="lists-panel">
          <header className="list-detail-header">
            <button
              className="secondary-button compact-button"
              type="button"
              onClick={() => setSelectedListId(null)}
            >
              Vissza
            </button>
            <div>
              <span
                className="list-icon"
                style={{ backgroundColor: selectedList.color ?? '#64748b' }}
                aria-hidden="true"
              >
                {selectedList.icon ?? listTypeDefaults[selectedList.list_type].icon}
              </span>
              <h1>{selectedList.title}</h1>
              <p>{completion.completed} / {completion.total} elintézve</p>
            </div>
            <button
              className="secondary-button compact-button"
              type="button"
              onClick={openListEdit}
            >
              Szerkesztés
            </button>
          </header>

          {selectedList.description ? (
            <p className="list-description">{selectedList.description}</p>
          ) : null}
          {selectedList.due_date ? (
            <p className={`list-due ${isPastDate(selectedList.due_date) ? 'overdue' : ''}`}>
              {getDueState(selectedList.due_date)}: {formatHungarianDate(selectedList.due_date)}
            </p>
          ) : null}
          <div className="list-progress" aria-label={`${completion.percentage}% kész`}>
            <span style={{ width: `${completion.percentage}%` }} />
          </div>

          <form
            className={[
              'quick-item-form',
              isShoppingList ? 'shopping-quick-item-form' : '',
            ].filter(Boolean).join(' ')}
            onSubmit={handleCreateItem}
          >
            {isShoppingList ? (
              <>
                <label className="quick-item-title-field" htmlFor="shoppingItemTitle">
                  Mit vegyünk?
                  <input
                    id="shoppingItemTitle"
                    value={newShoppingItem.title}
                    onChange={(event) =>
                      setNewShoppingItem((item) => ({
                        ...item,
                        title: event.target.value,
                      }))
                    }
                    placeholder="Tej"
                    required
                  />
                </label>
                <div className="quick-item-measure-fields">
                  <label htmlFor="shoppingItemQuantity">
                    Mennyiség
                    <input
                      id="shoppingItemQuantity"
                      type="number"
                      min="0"
                      step="any"
                      inputMode="decimal"
                      value={newShoppingItem.quantity}
                      onChange={(event) =>
                        setNewShoppingItem((item) => ({
                          ...item,
                          quantity: event.target.value,
                        }))
                      }
                      placeholder="2"
                    />
                  </label>
                  <label htmlFor="shoppingItemUnit">
                    Egység
                    <input
                      id="shoppingItemUnit"
                      value={newShoppingItem.unit}
                      onChange={(event) =>
                        setNewShoppingItem((item) => ({
                          ...item,
                          unit: event.target.value,
                        }))
                      }
                      list="shoppingUnitOptions"
                      placeholder={defaultShoppingUnit}
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={isSaving || !newShoppingItem.title.trim()}
                    aria-label="Elem hozzáadása"
                  >
                    +
                  </button>
                </div>
                <datalist id="shoppingUnitOptions">
                  {commonShoppingUnits.map((unit) => (
                    <option key={unit} value={unit} />
                  ))}
                </datalist>
              </>
            ) : (
              <>
                <input
                  value={newItemTitle}
                  onChange={(event) => setNewItemTitle(event.target.value)}
                  placeholder="Új elem hozzáadása..."
                />
                <button type="submit" disabled={isSaving || !newItemTitle.trim()}>
                  +
                </button>
              </>
            )}
          </form>

          {message ? <p className={`message ${message.type}`}>{message.text}</p> : null}

          <div className="list-item-list">
            {[...openItems, ...completedItems].map((item) => {
              const dueDate = item.due_at?.slice(0, 10) ?? null
              const overdue = !item.is_completed && isPastDate(dueDate)
              const quantityLabel = formatItemQuantity(item.quantity, item.unit)
              const itemMeta = isShoppingList
                ? ''
                : [
                    quantityLabel,
                    dueDate ? formatCompactDate(dueDate) : '',
                    item.priority !== 'normal' ? priorityLabels[item.priority] : '',
                  ].filter(Boolean).join(' ')
              return (
                <article
                  className={[
                    'list-item-row',
                    isShoppingList ? 'shopping-list-item-row' : '',
                    item.is_completed ? 'completed' : '',
                    overdue ? 'overdue' : '',
                  ].filter(Boolean).join(' ')}
                  key={item.id}
                >
                  <input
                    type="checkbox"
                    checked={item.is_completed}
                    onChange={() => void handleToggleItem(item)}
                    aria-label={`${item.title} kész`}
                  />
                  <button type="button" onClick={() => openItemEdit(item)}>
                    <strong>{item.title}</strong>
                    {itemMeta ? <span>{itemMeta}</span> : null}
                  </button>
                  {isShoppingList && quantityLabel ? (
                    <span className="shopping-item-quantity">{quantityLabel}</span>
                  ) : null}
                  <button
                    className="secondary-button compact-button"
                    type="button"
                    onClick={() => void handleDeleteItem(item)}
                  >
                    Törlés
                  </button>
                </article>
              )
            })}
          </div>

          <div className="list-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={() => void handleArchiveToggle()}
              disabled={isSaving}
            >
              {selectedList.is_archived ? 'Visszaállítás' : 'Archiválás'}
            </button>
            <button
              className="secondary-button danger-button"
              type="button"
              onClick={() => void handleDeleteList()}
              disabled={isSaving}
            >
              Lista törlése
            </button>
          </div>
        </section>

        <MobileBottomNav
          activeItem="lists"
          onHome={onOpenHome}
          onReports={onOpenReports}
          onAdd={onAddTransaction}
          onLists={() => setSelectedListId(null)}
          onProfile={onOpenProfile}
        />

        {isListEditOpen
          ? renderListForm('Lista szerkesztése', handleUpdateList, () =>
              setIsListEditOpen(false),
            )
          : null}

        {editingItem ? (
          <div className="modal-backdrop" role="presentation">
            <section className="modal-panel list-sheet" role="dialog" aria-modal="true">
              <div className="panel-header">
                <h2>Elem szerkesztése</h2>
                <button
                  className="secondary-button compact-button"
                  type="button"
                  onClick={() => setEditingItem(null)}
                  disabled={isSaving}
                >
                  Bezárás
                </button>
              </div>
              <form
                className={[
                  'list-form',
                  isShoppingList ? 'shopping-item-edit-form' : '',
                ].filter(Boolean).join(' ')}
                onSubmit={handleUpdateItem}
              >
                <label htmlFor="itemTitle">
                  Név
                  <input
                    id="itemTitle"
                    value={itemForm.title}
                    onChange={(event) =>
                      setItemForm((form) => ({ ...form, title: event.target.value }))
                    }
                    required
                  />
                </label>
                {!isShoppingList ? (
                  <label htmlFor="itemNotes">
                    Jegyzet
                    <textarea
                      id="itemNotes"
                      value={itemForm.notes}
                      onChange={(event) =>
                        setItemForm((form) => ({ ...form, notes: event.target.value }))
                      }
                      rows={3}
                    />
                  </label>
                ) : null}
                <div className="list-form-row">
                  <label htmlFor="itemQuantity">
                    Mennyiség
                    <input
                      id="itemQuantity"
                      type="number"
                      min="0"
                      step="any"
                      inputMode="decimal"
                      value={itemForm.quantity}
                      onChange={(event) =>
                        setItemForm((form) => ({
                          ...form,
                          quantity: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label htmlFor="itemUnit">
                    Egység
                    <input
                      id="itemUnit"
                      value={itemForm.unit}
                      list="shoppingUnitEditOptions"
                      onChange={(event) =>
                        setItemForm((form) => ({ ...form, unit: event.target.value }))
                      }
                    />
                  </label>
                </div>
                <datalist id="shoppingUnitEditOptions">
                  {commonShoppingUnits.map((unit) => (
                    <option key={unit} value={unit} />
                  ))}
                </datalist>
                {!isShoppingList ? (
                  <>
                    <label htmlFor="itemDueAt">
                      Határidő
                      <input
                        id="itemDueAt"
                        type="datetime-local"
                        value={itemForm.dueAt}
                        onChange={(event) =>
                          setItemForm((form) => ({ ...form, dueAt: event.target.value }))
                        }
                      />
                    </label>
                    <label htmlFor="itemPriority">
                      Prioritás
                      <select
                        id="itemPriority"
                        value={itemForm.priority}
                        onChange={(event) =>
                          setItemForm((form) => ({
                            ...form,
                            priority: event.target.value as ListPriority,
                          }))
                        }
                      >
                        {Object.entries(priorityLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                ) : null}
                <button className="primary-button" type="submit" disabled={isSaving}>
                  {isSaving ? 'Mentés...' : 'Mentés'}
                </button>
              </form>
            </section>
          </div>
        ) : null}
      </main>
    )
  }

  return (
    <main className="app-shell page-shell">
      <section className="lists-panel">
        <header className="lists-header">
          <div>
            <BrandHeader section="Listák" onHome={onOpenHome} />
            <p>Bevásárlás, teendők, emlékeztetők és egyéni listák.</p>
          </div>
          <button
            className="primary-button compact-list-action"
            type="button"
            onClick={() => {
              resetListForm()
              setIsCreateOpen(true)
            }}
          >
            Új lista
          </button>
        </header>

        <div className="list-tabs" aria-label="Lista szűrő">
          {[
            ['active', 'Aktív'],
            ['completed', 'Befejezett'],
            ['archived', 'Archivált'],
          ].map(([value, label]) => (
            <button
              key={value}
              className={activeTab === value ? 'active' : ''}
              type="button"
              onClick={() => setActiveTab(value as ListTab)}
            >
              {label}
            </button>
          ))}
        </div>

        {message ? <p className={`message ${message.type}`}>{message.text}</p> : null}

        {isLoading ? (
          <p className="empty-state">Listák betöltése...</p>
        ) : filteredLists.length === 0 ? (
          <div className="empty-state">
            <p>Még nincs listád.</p>
            <button
              className="primary-button compact-list-action"
              type="button"
              onClick={() => {
                resetListForm()
                setIsCreateOpen(true)
              }}
            >
              Új lista
            </button>
          </div>
        ) : (
          <div className="list-card-grid">
            {filteredLists.map((list) => {
              const completion = getCompletion(list.items)
              const dueState = getDueState(list.due_date)
              return (
                <button
                  className={[
                    'list-card',
                    list.due_date && isPastDate(list.due_date) ? 'overdue' : '',
                  ].filter(Boolean).join(' ')}
                  key={list.id}
                  type="button"
                  onClick={() => setSelectedListId(list.id)}
                  style={{ '--list-color': list.color ?? '#64748b' } as CSSProperties}
                >
                  <span className="list-card-icon" aria-hidden="true">
                    {list.icon ?? listTypeDefaults[list.list_type].icon}
                  </span>
                  <span className="list-card-main">
                    <strong>{list.title}</strong>
                    <small>{listTypeLabels[list.list_type]}</small>
                    <span>{completion.completed} / {completion.total} elintézve</span>
                    <i className="list-progress">
                      <b style={{ width: `${completion.percentage}%` }} />
                    </i>
                    {list.due_date ? (
                      <em>{dueState}: {formatHungarianDate(list.due_date)}</em>
                    ) : null}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </section>

      <MobileBottomNav
        activeItem="lists"
        onHome={onOpenHome}
        onReports={onOpenReports}
        onAdd={onAddTransaction}
        onLists={() => undefined}
        onProfile={onOpenProfile}
      />

      {isCreateOpen
        ? renderListForm('Új lista', handleCreateList, () => setIsCreateOpen(false))
        : null}
    </main>
  )
}

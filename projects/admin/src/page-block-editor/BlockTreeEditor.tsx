import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Button, Layout, Radio, Space } from 'antd'
import {
  ArrowLeftOutlined,
  DesktopOutlined,
  MobileOutlined,
  RedoOutlined,
  UndoOutlined,
} from '@ant-design/icons'
import { blockTypeMap } from '@sc/blocks'
import type { BlockInstance, BlockSize, Pos9 } from '../api/types'
import { applyReorder } from './dnd-tree'
import type { ReorderMove } from './dnd-tree'
import { BlockList } from './BlockList'
import { SettingsPanel } from './SettingsPanel'
import { PreviewCanvas } from './PreviewCanvas'
import {
  cloneWithNewIds,
  findNode,
  findParent,
  insertAfterImm,
  insertChild,
  moveBefore,
  moveSibling,
  removeById,
  updateNode,
} from './tree'

const { Sider, Header, Content } = Layout

// 純受控編輯器:只認 blocks(value)+ 一個動作區插槽 submitterRender(控制反轉)。
// 它不知道「儲存 / 草稿 / 發布 / 預覽」是什麼——那些全由消費者在 submitterRender 裡自行渲染。
// 不抓資料、不知道 react-query、不知道自己在編哪個模板/版位——資料組裝是叫用它的人的事。
export function BlockTreeEditor({
  title,
  initialBlocks,
  readOnly,
  contextHeader,
  contextFooter,
  frame = 'page',
  onBack,
  submitterRender,
}: {
  title: string
  initialBlocks: BlockInstance[]
  readOnly?: boolean
  contextHeader?: BlockInstance[]
  contextFooter?: BlockInstance[]
  /** 正在編的是頁面 / 頁首 / 頁尾 —— 讓畫布畫出「假頁面 body」示意外框的位置。 */
  frame?: 'page' | 'header' | 'footer'
  onBack: () => void
  /** 動作區插槽:編輯器給當前 blocks,消費者回傳要放的按鈕(存草稿/發布/預覽/唯讀標籤…)。 */
  submitterRender?: (blocks: BlockInstance[]) => ReactNode
}) {
  const [blocks, setBlocks] = useState<BlockInstance[]>(initialBlocks)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [past, setPast] = useState<BlockInstance[][]>([])
  const [future, setFuture] = useState<BlockInstance[][]>([])

  const selected = useMemo(
    () => (selectedId ? findNode(blocks, selectedId) : null),
    [blocks, selectedId],
  )

  const stateRef = useRef<{ blocks: BlockInstance[]; selectedId: string | null }>({
    blocks,
    selectedId,
  })
  stateRef.current = { blocks, selectedId }
  const clipboard = useRef<BlockInstance | null>(null)
  const lastKeyRef = useRef<string | null>(null)

  // commit:所有變更走這裡並記歷史。coalesceKey 相同(連續拖同一顆)只記一步。
  const commit = useCallback((next: BlockInstance[], coalesceKey?: string) => {
    const cur = stateRef.current.blocks
    const shouldPush = !coalesceKey || coalesceKey !== lastKeyRef.current
    if (shouldPush && cur) setPast((p) => [...p.slice(-49), cur])
    lastKeyRef.current = coalesceKey ?? null
    setFuture([])
    setBlocks(next)
  }, [])

  const undo = useCallback(() => {
    lastKeyRef.current = null
    const cur = stateRef.current.blocks
    setPast((p) => {
      if (p.length === 0) return p
      setBlocks(p[p.length - 1])
      if (cur) setFuture((f) => [cur, ...f])
      return p.slice(0, -1)
    })
  }, [])

  const redo = useCallback(() => {
    lastKeyRef.current = null
    const cur = stateRef.current.blocks
    setFuture((f) => {
      if (f.length === 0) return f
      setBlocks(f[0])
      if (cur) setPast((p) => [...p, cur])
      return f.slice(1)
    })
  }, [])

  const insertBlock = useCallback(
    (type: string, parentId: string | null) => {
      const b = stateRef.current.blocks
      if (!b) return
      const bt = blockTypeMap[type]
      const inst: BlockInstance = {
        id: crypto.randomUUID().slice(0, 8),
        type,
        data: { ...bt.defaults },
      }
      const p = parentId ? findNode(b, parentId) : null
      const target = p && blockTypeMap[p.type]?.container ? parentId : null
      // 圖片丟進疊層 → 預設鋪滿當背景(不設就以自然尺寸溢出,還得手動去設 Fill)。
      if (type === 'image' && p?.type === 'stack') inst.size = { w: 'fill', h: 'fill' }
      commit(target ? insertChild(b, target, inst) : [...b, inst])
      setSelectedId(inst.id)
    },
    [commit],
  )

  const addBlock = useCallback(
    (type: string) => {
      const b = stateRef.current.blocks
      if (!b) return
      const sel = stateRef.current.selectedId
      const s = sel ? findNode(b, sel) : null
      insertBlock(type, s && blockTypeMap[s.type]?.container ? s.id : null)
    },
    [insertBlock],
  )

  const deleteBlock = useCallback(
    (id: string) => {
      const b = stateRef.current.blocks
      if (!b) return
      commit(removeById(b, id))
      if (stateRef.current.selectedId === id) setSelectedId(null)
    },
    [commit],
  )

  const duplicateBlock = useCallback(
    (id: string) => {
      const b = stateRef.current.blocks
      if (!b) return
      const node = findNode(b, id)
      if (!node) return
      const copy = cloneWithNewIds(node)
      commit(insertAfterImm(b, id, copy))
      setSelectedId(copy.id)
    },
    [commit],
  )

  const moveBlock = useCallback(
    (id: string, dir: -1 | 1) => {
      const b = stateRef.current.blocks
      if (!b) return
      commit(moveSibling(b, id, dir))
    },
    [commit],
  )

  const selectParent = useCallback(() => {
    const b = stateRef.current.blocks
    const sel = stateRef.current.selectedId
    if (!b || !sel) return
    setSelectedId(findParent(b, sel)?.id ?? null)
  }, [])

  const reorderBefore = useCallback(
    (id: string, beforeId: string | null) => {
      const b = stateRef.current.blocks
      if (!b) return
      commit(moveBefore(b, id, beforeId))
    },
    [commit],
  )

  // 樹的拖放:把「搬移意圖」套到當下 blocks(單一來源),不吃 BlockList 那份可能過期的 blocks。
  const reorderMove = useCallback(
    (move: ReorderMove) => {
      commit(applyReorder(stateRef.current.blocks, move))
    },
    [commit],
  )

  const renameBlock = useCallback(
    (id: string, name: string) => {
      const b = stateRef.current.blocks
      if (!b) return
      commit(updateNode(b, id, { name: name.trim() || undefined }))
    },
    [commit],
  )

  // 鍵盤:Undo/Redo、Delete、Ctrl+D 複製、Ctrl+C/V、Esc。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      const mod = e.ctrlKey || e.metaKey
      const sel = stateRef.current.selectedId

      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
        return
      }
      if (e.key === 'Escape') {
        setSelectedId(null)
        return
      }
      if (mod && e.key.toLowerCase() === 'v') {
        if (!clipboard.current) return
        e.preventDefault()
        const b = stateRef.current.blocks
        if (!b) return
        const copy = cloneWithNewIds(clipboard.current)
        let next = sel ? insertAfterImm(b, sel, copy) : [...b, copy]
        if (next === b) next = [...b, copy]
        commit(next)
        setSelectedId(copy.id)
        return
      }
      if (!sel) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        deleteBlock(sel)
      } else if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        duplicateBlock(sel)
      } else if (mod && e.key.toLowerCase() === 'c') {
        const b = stateRef.current.blocks
        if (!b) return
        const node = findNode(b, sel)
        if (node) clipboard.current = node
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [commit, deleteBlock, duplicateBlock, undo, redo])

  // 同一顆連續編輯(拖滑桿/挑色)coalesce 成一步 undo。
  const updateData = (data: Record<string, unknown>) => {
    if (!selectedId) return
    commit(updateNode(blocks, selectedId, { data }), `edit:${selectedId}`)
  }
  const updateSize = (size: BlockSize) => {
    if (!selectedId) return
    commit(updateNode(blocks, selectedId, { size }), `edit:${selectedId}`)
  }
  const updatePos = (pos: Pos9) => {
    if (!selectedId) return
    commit(updateNode(blocks, selectedId, { pos }), `edit:${selectedId}`)
  }
  const parent = selectedId ? findParent(blocks, selectedId) : null
  const parentIsStack = parent?.type === 'stack'
  const selectedName = selected
    ? selected.name?.trim() || blockTypeMap[selected.type]?.name || selected.type
    : null

  return (
    <Layout className="fixed inset-0 z-1000" style={{ height: '100vh' }}>
      <Header
        style={{
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingInline: 32,
          borderBottom: '1px solid #eee',
        }}
      >
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={onBack}>
            返回
          </Button>
          <strong>{title}</strong>
        </Space>
        <Space>
          {!readOnly && (
            <>
              <Button
                icon={<UndoOutlined />}
                disabled={past.length === 0}
                onClick={undo}
                title="復原 Ctrl+Z"
              />
              <Button
                icon={<RedoOutlined />}
                disabled={future.length === 0}
                onClick={redo}
                title="重做 Ctrl+Shift+Z"
              />
            </>
          )}
          <Radio.Group
            value={device}
            optionType="button"
            buttonStyle="solid"
            onChange={(e) => setDevice(e.target.value)}
            options={[
              { label: <DesktopOutlined />, value: 'desktop' },
              { label: <MobileOutlined />, value: 'mobile' },
            ]}
          />
          {/* 動作區插槽:編輯器不認得動作,全由消費者渲染(儲存草稿/發布/預覽/唯讀標籤…)。 */}
          {submitterRender?.(blocks)}
        </Space>
      </Header>
      <Layout>
        {/* 唯讀時仍顯示圖層樹:客戶要能點選瀏覽自己的結構 / 設定,只是不能拖 / 改名 / 刪 / 新增。 */}
        <Sider width={260} theme="light" className="overflow-auto border-r border-[#eee] p-3">
          <BlockList
            blocks={blocks}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onAdd={addBlock}
            onDelete={deleteBlock}
            onDuplicate={duplicateBlock}
            onRename={renameBlock}
            onReorderMove={reorderMove}
            readOnly={readOnly}
          />
        </Sider>
        <Content className="overflow-auto">
          <PreviewCanvas
            blocks={blocks}
            selectedId={selectedId}
            selectedName={selectedName}
            hasParent={!!parent}
            onSelect={setSelectedId}
            onDropBlock={insertBlock}
            onDelete={deleteBlock}
            onDuplicate={duplicateBlock}
            onMove={moveBlock}
            onSelectParent={selectParent}
            onReorderBefore={reorderBefore}
            device={device}
            variant="preview"
            header={contextHeader}
            footer={contextFooter}
            frame={frame}
            readOnly={readOnly}
          />
        </Content>
        {/* 唯讀時仍顯示設定面板,欄位全部 disabled —— 客戶看得到當初的設定值。 */}
        <Sider width={300} theme="light" className="overflow-auto border-l border-[#eee] p-3">
          <SettingsPanel
            instance={selected}
            onChange={updateData}
            onSize={updateSize}
            onPos={updatePos}
            parentIsStack={parentIsStack}
            readOnly={readOnly}
          />
        </Sider>
      </Layout>
    </Layout>
  )
}

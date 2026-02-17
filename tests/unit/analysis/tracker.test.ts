import { describe, it, expect, beforeEach } from 'vitest'
import { Tracker } from '../../../src/analysis/tracker'

describe('Tracker', () => {
  let tracker: Tracker

  beforeEach(() => {
    tracker = new Tracker()
  })

  describe('processChangeEvent', () => {
    it('行が単純に更新（置換）された場合、その行を dirty にすること', () => {
      const lineMethods = [null, null, null]
      const event = {
        changes: [{
          range: { startLineNumber: 2, endLineNumber: 2 },
          text: 'new content'
        }]
      }
      
      tracker.processChangeEvent(event, lineMethods)
      
      expect(Array.from(tracker.getDirtyLines())).toContain(1) // 0-indexed
      expect(lineMethods.length).toBe(3) // 行数は変わらない
    })

    it('行が追加された場合、以降のキャッシュをずらし、新しい行を dirty にすること', () => {
      const lineMethods = [['m1'], ['m2'], ['m3']]
      const event = {
        changes: [{
          range: { startLineNumber: 2, endLineNumber: 2 },
          text: 'line2\nline3' // 1行が2行になる（1行追加）
        }]
      }

      tracker.processChangeEvent(event as any, lineMethods)

      expect(lineMethods).toEqual([['m1'], ['m2'], null, ['m3']])
      expect(Array.from(tracker.getDirtyLines())).toContain(1)
      expect(Array.from(tracker.getDirtyLines())).toContain(2)
    })

    it('行が削除された場合、キャッシュを詰め、現在の行を dirty にすること', () => {
      const lineMethods = [['m1'], ['m2'], ['m3'], ['m4']]
      const event = {
        changes: [{
          range: { startLineNumber: 2, endLineNumber: 3 }, // 2行目から3行目までを置換
          text: 'shrunk' // 2行が1行になる（1行削除）
        }]
      }
      
      tracker.processChangeEvent(event as any, lineMethods)
      
      // Tracker.js line 29: lineMethods.splice(startLine + 1, Math.abs(diff))
      // startLine = 1, diff = -1 -> splice(2, 1) を実行
      expect(lineMethods).toEqual([['m1'], ['m2'], ['m4']])
      expect(Array.from(tracker.getDirtyLines())).toContain(1)
    })
  })

  describe('processChangeEvent with method cache', () => {
    it('行が挿入された場合、キャッシュされたメソッドの行番号を更新すること', () => {
      // 初期状態: メソッド 'foo' は3行目 (index 2) にある
      // lineMethods[2] = [{ name: 'foo', line: 3 }]
      const lineMethods: any[] = [
        null, 
        null, 
        [{ name: 'foo', line: 3 }]
      ]

      // 1行目に新しい行を挿入
      const event = {
        changes: [{
          range: { startLineNumber: 1, endLineNumber: 1 },
          text: 'new line\n' 
        }]
      }

      tracker.processChangeEvent(event as any, lineMethods)
      
      // 期待値: メソッド 'foo' は4行目 (index 3) に移動し、line プロパティも 4 に更新されるべき
      expect(lineMethods.length).toBe(4)
      const methodsOnLine4 = lineMethods[3]
      expect(methodsOnLine4).toBeDefined()
      expect(methodsOnLine4[0].name).toBe('foo')
      expect(methodsOnLine4[0].line).toBe(4)
    })

    it('行が削除された場合、キャッシュされたメソッドの行番号を更新すること', () => {
      // 初期状態: メソッド 'bar' は4行目 (index 3) にある
      const lineMethods: any[] = [
        null,
        null,
        null,
        [{ name: 'bar', line: 4 }]
      ]

      // 1行目を削除
      const event = {
        changes: [{
          range: { startLineNumber: 1, endLineNumber: 2 },
          text: '' 
        }]
      }

      tracker.processChangeEvent(event as any, lineMethods)

      // 期待値: メソッド 'bar' は3行目 (index 2) に移動し、line プロパティも 3 に更新されるべき
      expect(lineMethods.length).toBe(3)
      const methodsOnLine3 = lineMethods[2]
      expect(methodsOnLine3).toBeDefined()
      expect(methodsOnLine3[0].name).toBe('bar')
      expect(methodsOnLine3[0].line).toBe(3)
    })
  })

  describe('markAllDirty', () => {
    it('指定された行数分すべての行を dirty にすること', () => {
      tracker.markAllDirty(5)
      const dirty = tracker.getDirtyLines()
      expect(dirty.size).toBe(5)
      expect(Array.from(dirty)).toEqual([0, 1, 2, 3, 4])
    })
  })

  describe('clearDirtyLines', () => {
    it('dirty 状態をリセットできること', () => {
      tracker.markAllDirty(3)
      tracker.clearDirtyLines()
      expect(tracker.getDirtyLines().size).toBe(0)
    })
  })
})


import { call, put, select, takeLatest } from 'redux-saga/effects'
import { compose, isNil, map, path, range } from 'ramda'
import { set } from 'ramda-lens'
import * as A from './actions'
import * as AT from './actionTypes'
import { KVStoreEntry } from '../../../types'
import { getMetadataXpriv } from '../root/selectors'
import { getHDAccounts } from '../../wallet/selectors'
import { derivationMap, BCH } from '../config'

const taskToPromise = t => new Promise((resolve, reject) => t.fork(reject, resolve))

export default ({ api }) => {
  const callTask = function * (task) {
    return yield call(compose(taskToPromise, () => task))
  }

  const createBch = function * (kv) {
    const hdAccounts = yield select(getHDAccounts)

    const createAccountEntry = x => ({
      label: `My Bitcoin Cash Wallet${x > 0 ? ` ${x + 1}` : ''}`,
      archived: path([x, 'archived'], hdAccounts) || false
    })

    const newBchEntry = {
      default_account_idx: 0,
      accounts: map(createAccountEntry, range(0, hdAccounts.length))
    }

    const newkv = set(KVStoreEntry.value, newBchEntry, kv)
    yield put(A.createMetadataBch(newkv))
  }

  const fetchMetadataBch = function * () {
    try {
      const typeId = derivationMap[BCH]
      const mxpriv = yield select(getMetadataXpriv)
      const kv = KVStoreEntry.fromMetadataXpriv(mxpriv, typeId)
      yield put(A.fetchMetadataBchLoading())
      const newkv = yield callTask(api.fetchKVStore(kv))
      if (isNil(newkv.value)) {
        yield call(createBch, newkv)
      } else {
        yield put(A.fetchMetadataBchSuccess(newkv))
      }
    } catch (e) {
      yield put(A.fetchMetadataBchFailure(e.message))
    }
  }

  return function * () {
    yield takeLatest(AT.FETCH_METADATA_BCH, fetchMetadataBch)
  }
}

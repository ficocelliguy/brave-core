// Copyright (c) 2023 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import { mapLimit } from 'async'

// types
import type { BaseQueryCache } from '../../async/base-query-cache'
import { BraveWallet, WalletState } from '../../../constants/types'
import { WalletApiEndpointBuilderParams } from '../api-base.slice'
import {
  ImportFromExternalWalletPayloadType,
  ShowRecoveryPhrasePayload
} from '../../../page/constants/action_types'

// actions
import { WalletPageActions } from '../../../page/actions'

// utils
import { handleEndpointError } from '../../../utils/api-utils'
import { getLocale } from '../../../../common/locale'
import { keyringIdForNewAccount } from '../../../utils/account-utils'
import { suggestNewAccountName } from '../../../utils/address-utils'
import { getEntitiesListFromEntityState } from '../../../utils/entities.utils'

type ImportWalletResults = {
  errorMessage?: string
}

export const walletEndpoints = ({
  mutation,
  query
}: WalletApiEndpointBuilderParams) => {
  return {
    getIsWalletBackedUp: query<boolean, void>({
      queryFn: async (arg, { endpoint }, extraOptions, baseQuery) => {
        try {
          const { data: api } = baseQuery(undefined)
          const { walletInfo } = await api.walletHandler.getWalletInfo()
          return {
            data: walletInfo.isWalletBackedUp
          }
        } catch (error) {
          return handleEndpointError(
            endpoint,
            'Unable to check if wallet is backed up',
            error
          )
        }
      },
      providesTags: ['IsWalletBackedUp']
    }),

    createWallet: mutation<true, { password: string }>({
      queryFn: async (
        arg,
        { endpoint, dispatch, getState },
        extraOptions,
        baseQuery
      ) => {
        try {
          const { data: api, cache } = baseQuery(undefined)
          const { keyringService } = api

          const result = await keyringService.createWallet(arg.password)

          dispatch(
            WalletPageActions.walletCreated({ mnemonic: result.mnemonic })
          )

          await createDefaultAccounts({
            allowNewWalletFilecoinAccount: (
              getState() as { wallet: WalletState }
            ).wallet.allowNewWalletFilecoinAccount,
            keyringService,
            cache
          })

          return {
            data: true
          }
        } catch (error) {
          return handleEndpointError(endpoint, 'Unable to create wallet', error)
        }
      }
    }),

    restoreWallet: mutation<
      { success: boolean; invalidMnemonic: boolean },
      {
        mnemonic: string
        password: string
        isLegacy: boolean
        completeWalletSetup?: boolean
      }
    >({
      queryFn: async (
        arg,
        { endpoint, dispatch, getState },
        extraOptions,
        baseQuery
      ) => {
        try {
          const { data: api, cache } = baseQuery(undefined)
          const { keyringService } = api

          const result = await keyringService.restoreWallet(
            arg.mnemonic,
            arg.password,
            arg.isLegacy
          )

          if (!result.isValidMnemonic) {
            return {
              data: {
                success: false,
                invalidMnemonic: true
              }
            }
          }

          cache.clearWalletInfo()
          keyringService.notifyWalletBackupComplete()

          if (arg?.completeWalletSetup) {
            dispatch(
              WalletPageActions.walletSetupComplete(arg.completeWalletSetup)
            )
          }

          await createDefaultAccounts({
            allowNewWalletFilecoinAccount: (
              getState() as { wallet: WalletState }
            ).wallet.allowNewWalletFilecoinAccount,
            keyringService,
            cache
          })

          return {
            data: {
              invalidMnemonic: false,
              success: true
            }
          }
        } catch (error) {
          return handleEndpointError(
            endpoint,
            'Unable to restore wallet from seed phrase',
            error
          )
        }
      },
      invalidatesTags: ['AccountInfos', 'IsWalletBackedUp']
    }),

    showRecoveryPhrase: mutation<boolean, ShowRecoveryPhrasePayload>({
      queryFn: async (arg, { endpoint, dispatch }, extraOptions, baseQuery) => {
        try {
          const { data: api } = baseQuery(undefined)
          const { keyringService } = api
          const { password } = arg

          if (password) {
            const { mnemonic } =
              await keyringService.getMnemonicForDefaultKeyring(password)
            dispatch(WalletPageActions.recoveryWordsAvailable({ mnemonic }))
            return {
              data: true
            }
          }

          dispatch(WalletPageActions.recoveryWordsAvailable({ mnemonic: '' }))

          return {
            data: true
          }
        } catch (error) {
          return handleEndpointError(
            endpoint,
            'Unable to fetch wallet recovery phrase',
            error
          )
        }
      }
    }),

    getWalletsToImport: query<
      {
        isMetaMaskInitialized: boolean
        isLegacyCryptoWalletsInitialized: boolean
      },
      void
    >({
      queryFn: async (arg, { endpoint }, extraOptions, baseQuery) => {
        try {
          const { data: api } = baseQuery(undefined)
          const { braveWalletService } = api

          const cwResult = await braveWalletService.isExternalWalletInitialized(
            BraveWallet.ExternalWalletType.CryptoWallets
          )
          const mmResult = await braveWalletService.isExternalWalletInitialized(
            BraveWallet.ExternalWalletType.MetaMask
          )

          return {
            data: {
              isLegacyCryptoWalletsInitialized: cwResult.initialized,
              isMetaMaskInitialized: mmResult.initialized
            }
          }
        } catch (error) {
          return handleEndpointError(
            endpoint,
            'Unable to fetch wallet extensions for import',
            error
          )
        }
      }
    }),

    checkExternalWalletPassword: mutation<
      { success: boolean; errorMessage?: string },
      { walletType: BraveWallet.ExternalWalletType; password: string }
    >({
      queryFn: async (arg, { endpoint }, extraOptions, baseQuery) => {
        try {
          const { data: api } = baseQuery(undefined)
          const { braveWalletService } = api

          const { errorMessage } =
            await braveWalletService.importFromExternalWallet(
              arg.walletType,
              arg.password,
              ''
            )

          // was the provided import password correct?
          const checkExistingPasswordError =
            errorMessage === getLocale('braveWalletImportPasswordError')
              ? errorMessage || undefined
              : undefined

          return {
            data: {
              errorMessage: checkExistingPasswordError,
              success: !checkExistingPasswordError
            }
          }
        } catch (error) {
          return handleEndpointError(
            endpoint,
            'Unable to check external wallet password',
            error
          )
        }
      },
      invalidatesTags: ['AccountInfos', 'IsWalletBackedUp']
    }),

    importFromCryptoWallets: mutation<
      { success: boolean; errorMessage?: string },
      ImportFromExternalWalletPayloadType
    >({
      queryFn: async (arg, { endpoint, getState }, extraOptions, baseQuery) => {
        try {
          if (!arg.newPassword) {
            throw new Error('A new password is required')
          }

          const { data: api, cache } = baseQuery(undefined)
          const { keyringService, braveWalletService } = api

          const results: ImportWalletResults = await importFromExternalWallet(
            BraveWallet.ExternalWalletType.CryptoWallets,
            arg,
            { braveWalletService, keyringService }
          )

          if (results.errorMessage) {
            return {
              data: {
                success: false,
                errorMessage: results.errorMessage
              }
            }
          }

          await createDefaultAccounts({
            allowNewWalletFilecoinAccount: (
              getState() as { wallet: WalletState }
            ).wallet.allowNewWalletFilecoinAccount,
            keyringService,
            cache
          })

          cache.clearWalletInfo()

          return {
            data: {
              success: true
            }
          }
        } catch (error) {
          return handleEndpointError(
            endpoint,
            'Unable to restore wallet from legacy crypto wallets extension',
            error
          )
        }
      },
      invalidatesTags: ['AccountInfos', 'IsWalletBackedUp']
    }),

    importFromMetaMask: mutation<
      { success: boolean; errorMessage?: string },
      ImportFromExternalWalletPayloadType
    >({
      queryFn: async (arg, { endpoint, getState }, extraOptions, baseQuery) => {
        try {
          if (!arg.newPassword) {
            throw new Error('A new password is required')
          }

          const { data: api, cache } = baseQuery(undefined)
          const { keyringService, braveWalletService } = api

          const { errorMessage }: ImportWalletResults =
            await importFromExternalWallet(
              BraveWallet.ExternalWalletType.MetaMask,
              arg,
              { braveWalletService, keyringService }
            )

          if (errorMessage) {
            return {
              data: {
                errorMessage,
                success: false
              }
            }
          }

          await createDefaultAccounts({
            allowNewWalletFilecoinAccount: (
              getState() as { wallet: WalletState }
            ).wallet.allowNewWalletFilecoinAccount,
            keyringService,
            cache
          })

          cache.clearWalletInfo()

          return {
            data: { success: true }
          }
        } catch (error) {
          return handleEndpointError(
            endpoint,
            'Unable to restore wallet from MetaMask extension',
            error
          )
        }
      },
      invalidatesTags: ['AccountInfos', 'IsWalletBackedUp']
    }),

    completeWalletBackup: mutation<boolean, void>({
      queryFn: async (arg, { endpoint }, extraOptions, baseQuery) => {
        try {
          const { data: api } = baseQuery(undefined)
          const { keyringService } = api

          keyringService.notifyWalletBackupComplete()

          return {
            data: true
          }
        } catch (error) {
          return handleEndpointError(
            endpoint,
            'Unable to complete wallet backup',
            error
          )
        }
      },
      invalidatesTags: ['IsWalletBackedUp']
    })
  }
}

// Internals
async function importFromExternalWallet(
  walletType: BraveWallet.ExternalWalletType,
  payload: ImportFromExternalWalletPayloadType,
  services: {
    braveWalletService: BraveWallet.BraveWalletServiceRemote
    keyringService: BraveWallet.KeyringServiceRemote
  }
): Promise<ImportWalletResults> {
  // need new password to continue
  if (!payload.newPassword) {
    return { errorMessage: undefined }
  }

  const { braveWalletService, keyringService } = services

  const { errorMessage } = await braveWalletService.importFromExternalWallet(
    walletType,
    payload.password,
    payload.newPassword
  )

  // complete backup
  if (!errorMessage) {
    keyringService.notifyWalletBackupComplete()
  }

  return {
    errorMessage: errorMessage || undefined
  }
}

async function createDefaultAccounts({
  allowNewWalletFilecoinAccount,
  keyringService,
  cache
}: {
  cache: BaseQueryCache
  keyringService: BraveWallet.KeyringServiceRemote
  allowNewWalletFilecoinAccount: boolean
}) {
  const networksRegistry = await cache.getNetworksRegistry()
  const accountsRegistry = await cache.getAccountsRegistry()

  const visibleNetworks = getEntitiesListFromEntityState(
    networksRegistry,
    networksRegistry.visibleIds
  )

  const networkKeyrings: number[] = []
  const networksWithUniqueKeyrings = []

  for (const net of visibleNetworks) {
    const keyringId = keyringIdForNewAccount(net.coin, net.chainId)
    if (!networkKeyrings.includes(keyringId)) {
      networkKeyrings.push(keyringId)
      networksWithUniqueKeyrings.push(net)
    }
  }

  const accounts = getEntitiesListFromEntityState(accountsRegistry)

  // create accounts for visible network coin types if needed
  await mapLimit(
    networksWithUniqueKeyrings,
    3,
    async function (net: BraveWallet.NetworkInfo) {
      if (
        // TODO: remove this check when we can hide "default" networks
        net.coin === BraveWallet.CoinType.FIL &&
        allowNewWalletFilecoinAccount
      ) {
        await keyringService.addAccount(
          net.coin,
          keyringIdForNewAccount(net.coin, net.chainId),
          suggestNewAccountName(accounts, net)
        )
      }
    }
  )
}

// Copyright (c) 2023 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import * as React from 'react'
import { useDispatch } from 'react-redux'
import { EntityId } from '@reduxjs/toolkit'
import { useHistory } from 'react-router'
import Checkbox from '@brave/leo/react/checkbox'
import ProgressRing from '@brave/leo/react/progressRing'

// context
import {
  ChainSelectionContextProvider,
  useChainSelectionContext
} from '../../../../common/context/network_selection_context'

// utils
import { getLocale } from '../../../../../common/locale'
import {
  getNetworkId //
} from '../../../../common/slices/entities/network.entity'
import {
  getOnboardingTypeFromPath,
  openNetworkSettings
} from '../../../../utils/routes-utils'
import { useLocationPathName } from '../../../../common/hooks/use-pathname'

// queries
import {
  useGetAllKnownNetworksQuery,
  useHideNetworksMutation,
  useRestoreNetworksMutation
} from '../../../../common/slices/api.slice'

// types
import {
  BraveWallet,
  SupportedTestNetworkEntityIds,
  SupportedTestNetworks,
  WalletRoutes
} from '../../../../constants/types'

// components
import {
  NavButton //
} from '../../../../components/extension/buttons/nav-button/index'
import { SearchBar } from '../../../../components/shared/search-bar'
import {
  CreateNetworkIcon //
} from '../../../../components/shared/create-network-icon'
import {
  CenteredPageLayout //
} from '../../../../components/desktop/centered-page-layout/centered-page-layout'
import {
  OnboardingStepsNavigation //
} from '../components/onboarding-steps-navigation/onboarding-steps-navigation'

// styles
import {
  Column,
  MutedLinkText,
  Row,
  ScrollableColumn,
  Text,
  VerticalSpace
} from '../../../../components/shared/style'
import {
  StyledWrapper,
  Title,
  Description,
  NextButtonRow,
  MainWrapper,
  TitleAndDescriptionContainer
} from '../onboarding.style'
import {
  SelectAllText,
  GroupingText
} from './onboarding_network_selection.style'
import { WalletActions } from '../../../../common/actions'

// Featured Networks
const EthMainnetId = getNetworkId({
  chainId: BraveWallet.MAINNET_CHAIN_ID,
  coin: BraveWallet.CoinType.ETH
})

const SolMainnetId = getNetworkId({
  chainId: BraveWallet.SOLANA_MAINNET,
  coin: BraveWallet.CoinType.SOL
})

const FilMainnetId = getNetworkId({
  chainId: BraveWallet.FILECOIN_MAINNET,
  coin: BraveWallet.CoinType.FIL
})

const featuredChainIds = [
  BraveWallet.SOLANA_MAINNET,
  BraveWallet.MAINNET_CHAIN_ID,
  BraveWallet.FILECOIN_MAINNET
]

/** Forcing ETH, SOL account creation until their networks can be hidden */
const mandatoryChainIds = [
  BraveWallet.SOLANA_MAINNET,
  BraveWallet.MAINNET_CHAIN_ID
]

function NetworkCheckbox({
  network,
  isDisabled
}: {
  network: BraveWallet.NetworkInfo
  isDisabled?: boolean
}) {
  // context
  const [selectedChains, selectChains] = useChainSelectionContext()

  // computed
  const chainIdentifier = getNetworkId(network)
  const isChecked = selectedChains.includes(chainIdentifier)

  // render
  return (
    <Column margin={'0px 0px 16px 0px'}>
      <Checkbox
        isDisabled={isDisabled}
        checked={isChecked}
        onChange={() =>
          selectChains((prev) =>
            isChecked
              ? prev.filter((id) => id !== chainIdentifier)
              : prev.concat(chainIdentifier)
          )
        }
      >
        <CreateNetworkIcon
          network={network}
          marginRight={0}
          size='big'
        />
        <Text
          textSize='14px'
          isBold={false}
        >
          {network.chainName}
        </Text>
      </Checkbox>
    </Column>
  )
}

export const OnboardingNetworkSelection = () => {
  // routing
  const history = useHistory()
  const path = useLocationPathName()
  const onboardingType = getOnboardingTypeFromPath(path)

  // redux
  const dispatch = useDispatch()

  // state
  const [searchText, setSearchText] = React.useState('')
  const [showTestNets, setShowTestNets] = React.useState(false)
  const [selectedChainsForContext, setSelectedChains] = React.useState<
    EntityId[]
  >([EthMainnetId, SolMainnetId, FilMainnetId])

  /** Always include test networks */
  const selectedChainsContext = React.useMemo(
    () => [selectedChainsForContext, setSelectedChains] as const,
    [selectedChainsForContext, setSelectedChains]
  )

  // filter out test networks if needed
  const selectedChains = showTestNets
    ? selectedChainsForContext
    : selectedChainsForContext.filter(
        (id) => !SupportedTestNetworkEntityIds.includes(id)
      )

  // queries
  const { data: networks, isLoading: isLoadingNetworks } =
    useGetAllKnownNetworksQuery()

  // mutations
  const [hideNetworks] = useHideNetworksMutation()
  const [restoreNetworks] = useRestoreNetworksMutation()

  // memos
  const { featuredNetworks, popularNetworks } = React.useMemo(() => {
    if (!networks) {
      return {
        featuredNetworks: [],
        popularNetworks: []
      }
    }
    // group networks
    const featuredNetworks = featuredChainIds
      .map((id) => networks.find((net) => net.chainId === id))
      .filter((net): net is BraveWallet.NetworkInfo => Boolean(net))

    const popularNetworks = networks.filter(
      (net) => !featuredChainIds.includes(net.chainId)
    )

    // sort popular networks
    popularNetworks.sort((a, b) => a.chainName.localeCompare(b.chainName))

    // remove test networks if needed
    return {
      featuredNetworks,
      popularNetworks: showTestNets
        ? popularNetworks
        : popularNetworks.filter(
            ({ chainId }) => !SupportedTestNetworks.includes(chainId)
          )
    }
  }, [networks, showTestNets])

  const { filteredFeaturedNetworks, filteredPopularNetworks } =
    React.useMemo(() => {
      const trimmedSearchText = searchText.trim()
      if (!trimmedSearchText) {
        return {
          filteredFeaturedNetworks: featuredNetworks,
          filteredPopularNetworks: popularNetworks
        }
      }
      return {
        filteredFeaturedNetworks: featuredNetworks.filter(({ chainName }) =>
          chainName.toLowerCase().includes(trimmedSearchText)
        ),
        filteredPopularNetworks: popularNetworks.filter(({ chainName }) =>
          chainName.toLowerCase().includes(trimmedSearchText)
        )
      }
    }, [featuredNetworks, popularNetworks, searchText])

  // methods
  const onSubmit = React.useCallback(async () => {
    if (!networks) {
      // wait for networks
      return
    }

    const selectedNetworks: Array<
      Pick<BraveWallet.NetworkInfo, 'chainId' | 'coin'>
    > = []
    const hiddenNets: Array<Pick<BraveWallet.NetworkInfo, 'chainId' | 'coin'>> =
      []

    for (const net of networks) {
      if (selectedChains.includes(getNetworkId(net))) {
        selectedNetworks.push({ chainId: net.chainId, coin: net.coin })
      } else {
        hiddenNets.push({ chainId: net.chainId, coin: net.coin })
      }
    }

    // hide non-selected networks
    await hideNetworks(hiddenNets).unwrap()

    // force show selected networks
    await restoreNetworks(selectedNetworks).unwrap()

    // Temporary workaround to prevent unwanted filecoin account creation
    dispatch(
      WalletActions.setAllowNewWalletFilecoinAccount(
        selectedNetworks.some((net) => net.coin === BraveWallet.CoinType.FIL)
      )
    )

    // TODO: mark coin-types for wallet creation
    history.push(
      onboardingType === 'hardware'
        ? WalletRoutes.OnboardingHardwareWalletCreatePassword
        : onboardingType === 'import'
        ? WalletRoutes.OnboardingImportOrRestore
        : WalletRoutes.OnboardingNewWalletCreatePassword
    )
  }, [onboardingType, selectedChains, networks])

  // effects
  React.useEffect(() => {
    if (!networks) {
      return
    }

    // pre-populate selected chains (no testnets)
    setSelectedChains(
      networks.map(getNetworkId).filter((netId) => {
        // pre-select non-testnets
        return !SupportedTestNetworkEntityIds.includes(netId)
      })
    )
  }, [networks])

  // render
  return (
    <CenteredPageLayout>
      <MainWrapper>
        <StyledWrapper>
          <OnboardingStepsNavigation preventSkipAhead />

          <TitleAndDescriptionContainer>
            <Title>{getLocale('braveWalletSupportedNetworks')}</Title>
            <Description>
              {getLocale('braveWalletChooseChainsToUse')}
            </Description>
          </TitleAndDescriptionContainer>

          <Column
            fullWidth
            alignItems='flex-start'
          >
            <SearchBar
              value={searchText}
              action={(e) => {
                setSearchText(e.target.value)
              }}
              placeholder='Search networks'
              autoFocus
            />
            <Row justifyContent='flex-end'>
              <Checkbox
                checked={showTestNets}
                onChange={() => setShowTestNets((prev) => !prev)}
              >
                <Text
                  textSize='14px'
                  isBold={false}
                >
                  {getLocale('braveWalletShowTestnets')}
                </Text>
              </Checkbox>
            </Row>

            <ScrollableColumn
              maxHeight={'300px'}
              padding={'0px 8px 0px 0px'}
            >
              <ChainSelectionContextProvider value={selectedChainsContext}>
                {isLoadingNetworks ? (
                  <Column
                    fullHeight
                    fullWidth
                  >
                    <ProgressRing mode='indeterminate' />
                  </Column>
                ) : (
                  <>
                    {filteredFeaturedNetworks.length > 0 ? (
                      <GroupingText>
                        {getLocale('braveWalletFeatured')}
                      </GroupingText>
                    ) : null}
                    {filteredFeaturedNetworks.map((net) => {
                      return (
                        <NetworkCheckbox
                          isDisabled={mandatoryChainIds.includes(net.chainId)}
                          key={getNetworkId(net)}
                          network={net}
                        />
                      )
                    })}
                    <Row
                      alignItems='center'
                      justifyContent='space-between'
                    >
                      <GroupingText>
                        {getLocale('braveWalletPopular')}
                      </GroupingText>
                      {networks && (
                        <SelectAllText
                          onClick={() => {
                            setSelectedChains(
                              showTestNets
                                ? networks.map(getNetworkId)
                                : networks
                                    .map(getNetworkId)
                                    .filter(
                                      (id) =>
                                        !SupportedTestNetworkEntityIds.includes(
                                          id
                                        )
                                    )
                            )
                          }}
                        >
                          {getLocale('braveWalletSelectAll')}
                        </SelectAllText>
                      )}
                    </Row>
                    {filteredPopularNetworks.map((net) => (
                      <NetworkCheckbox
                        key={getNetworkId(net)}
                        network={net}
                      />
                    ))}
                  </>
                )}
              </ChainSelectionContextProvider>
            </ScrollableColumn>

            <VerticalSpace space='44px' />
          </Column>

          <NextButtonRow>
            <NavButton
              buttonType='primary'
              text={
                selectedChains.length
                  ? getLocale('braveWalletContinueWithXItems')
                      .replace(
                        '$1', // Number of items
                        selectedChains.length.toString()
                      )
                      .replace(
                        '$2', // Item name (maybe plural)
                        selectedChains.length > 1
                          ? getLocale('braveWalletNetworks')
                          : getLocale(
                              'braveWalletAllowAddNetworkNetworkPanelTitle'
                            )
                      )
                  : getLocale('braveWalletButtonContinue')
              }
              onSubmit={onSubmit}
              disabled={selectedChains.length === 0}
            />
          </NextButtonRow>
          <MutedLinkText onClick={openNetworkSettings}>
            {getLocale('braveWalletAddNetworksAnytimeInSettings')}
          </MutedLinkText>
        </StyledWrapper>
      </MainWrapper>
    </CenteredPageLayout>
  )
}

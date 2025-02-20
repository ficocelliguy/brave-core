// Copyright (c) 2023 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import * as React from 'react'
import { loadTimeData } from '$web-common/loadTimeData'

import getPageHandlerInstance, * as mojom from '../api/page_handler'
import DataContext, { AIChatContext } from './context'

// TODO(petemill): Build account urls in the browser
const URL_REFRESH_PREMIUM_SESSION = 'https://account.brave.com/?intent=recover&product=leo'
const URL_GO_PREMIUM = 'https://account.brave.com/account/?intent=checkout&product=leo'
const URL_MANAGE_PREMIUM = 'https://account.brave.com/'

function toBlobURL(data: number[] | null) {
  if (!data) return undefined

  const blob = new Blob([new Uint8Array(data)], { type: 'image/*' })
  return URL.createObjectURL(blob)
}

interface DataContextProviderProps {
  children: React.ReactNode
}

function DataContextProvider (props: DataContextProviderProps) {
  const [currentModelKey, setCurrentModelKey] = React.useState<string>();
  const [allModels, setAllModels] = React.useState<mojom.Model[]>([])
  const [hasChangedModel, setHasChangedModel] = React.useState(false)
  const [conversationHistory, setConversationHistory] = React.useState<mojom.ConversationTurn[]>([])
  const [suggestedQuestions, setSuggestedQuestions] = React.useState<string[]>([])
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [suggestionStatus, setSuggestionStatus] = React.useState<mojom.SuggestionGenerationStatus>(mojom.SuggestionGenerationStatus.None)
  // undefined for nothing received yet
  // null for no site info
  // mojom.SiteInfo for valid site info
  const [siteInfo, setSiteInfo] = React.useState<mojom.SiteInfo | null | undefined>(undefined)
  const [favIconUrl, setFavIconUrl] = React.useState<string>()
  const [currentError, setCurrentError] = React.useState<mojom.APIError>(mojom.APIError.None)
  const [hasAcceptedAgreement, setHasAcceptedAgreement] = React.useState(loadTimeData.getBoolean("hasAcceptedAgreement"))
  const [premiumStatus, setPremiumStatus] = React.useState<mojom.PremiumStatus | undefined>(undefined)
  const [canShowPremiumPrompt, setCanShowPremiumPrompt] = React.useState<boolean | undefined>()
  const [hasDismissedLongPageWarning, setHasDismissedLongPageWarning] = React.useState<boolean>(false)
  const [hasDismissedLongConversationInfo, setHasDismissedLongConversationInfo] = React.useState<boolean>(false)

  // Provide a custom handler for setCurrentModel instead of a useEffect
  // so that we can track when the user has changed a model in
  // order to provide more information about the model.
  const setCurrentModel = (model: mojom.Model) => {
    setHasChangedModel(true)
    setCurrentModelKey(model.key)
    getPageHandlerInstance().pageHandler.changeModel(model.key)
  }

  const currentModel: mojom.Model | undefined = React.useMemo(() => {
    if (!currentModelKey) {
      return
    }
    const found = allModels.find(m => m.key === currentModelKey)
    if (!found) {
      console.error(`onModelChanged: could not find matching model for key: "${currentModelKey}" in list of model keys: ${allModels.map(m => m.key).join(', ')}`)
      return
    }
    return found
  }, [allModels, currentModelKey])

  const isPremiumUser = premiumStatus !== undefined && premiumStatus !== mojom.PremiumStatus.Inactive

  const apiHasError = (currentError !== mojom.APIError.None)
  const shouldDisableUserInput = !!(apiHasError || isGenerating || (!isPremiumUser && currentModel?.isPremium))

  // Wait to show model intro until we've received SiteInfo information
  // (valid or null) to avoid flash of content.
  const showModelIntro =
    hasAcceptedAgreement && (hasChangedModel || siteInfo === null)

  const getConversationHistory = () => {
    getPageHandlerInstance()
      .pageHandler.getConversationHistory()
      .then((res) => setConversationHistory(res.conversationHistory))
  }

  const getSuggestedQuestions = () => {
    getPageHandlerInstance()
      .pageHandler.getSuggestedQuestions()
      .then((r) => {
        setSuggestedQuestions(r.questions)
        setSuggestionStatus(r.suggestionStatus)
      })
  }

  const generateSuggestedQuestions = () => {
    getPageHandlerInstance().pageHandler.generateQuestions()
  }

  const handleSiteInfo = (isFetching: boolean, siteInfo: mojom.SiteInfo | null) => {
    // null siteInfo for no content
    // true isFetching for unknown yet
    if (!isFetching) {
      setSiteInfo(siteInfo)
    } else {
      setSiteInfo(undefined)
    }
  }

  const getSiteInfo = () => {
    getPageHandlerInstance()
      .pageHandler.getSiteInfo()
      .then(({ isFetching, siteInfo }) => {
        handleSiteInfo(isFetching, siteInfo)
      })
  }

  const getFaviconData = () => {
    getPageHandlerInstance()
      .pageHandler.getFaviconImageData()
      .then((data) => {
        setFavIconUrl(toBlobURL(data.faviconImageData))
      })
  }

  const getCurrentAPIError = () => {
    getPageHandlerInstance()
      .pageHandler.getAPIResponseError()
      .then((data) => {
        setCurrentError(data.error)
      })
  }

  const handleAgreeClick = () => {
    setHasAcceptedAgreement(true)
    getPageHandlerInstance().pageHandler.markAgreementAccepted()
  }

  const getCanShowPremiumPrompt = () => {
    getPageHandlerInstance().pageHandler.getCanShowPremiumPrompt()
      .then(resp => setCanShowPremiumPrompt(resp.canShow))
  }

  const dismissPremiumPrompt = () => {
    getPageHandlerInstance().pageHandler.dismissPremiumPrompt()
    setCanShowPremiumPrompt(false)
  }

  const switchToDefaultModel = () => {
    // Select the first non-premium model
    const nonPremium = allModels.find(m => !m.isPremium)
    if (!nonPremium) {
      console.error('Could not find a non-premium model!')
      return
    }
    setCurrentModel(nonPremium)
  }

  const updateCurrentPremiumStatus = async () => {
    console.debug('Getting premium status...')
    const premiumStatus = await getPageHandlerInstance().pageHandler.getPremiumStatus()
    console.debug('got premium status: ', premiumStatus.result)
    setPremiumStatus(premiumStatus.result)
  }

  const userRefreshPremiumSession = () => {
    getPageHandlerInstance().pageHandler.openURL({ url: URL_REFRESH_PREMIUM_SESSION })
  }

  const shouldShowLongPageWarning = React.useMemo(() => {
    if (
      !hasDismissedLongPageWarning &&
      conversationHistory.length >= 1 &&
      siteInfo?.isContentTruncated
    ) {
      return true
    }

    return false
  }, [conversationHistory, hasDismissedLongPageWarning, siteInfo?.isContentTruncated])

  const shouldShowLongConversationInfo = React.useMemo(() => {
    if (!currentModel) return false

    const chatHistoryCharTotal = conversationHistory.reduce((charCount, curr) => charCount + curr.text.length, 0)

    // TODO(nullhook): make this more accurately based on the actual page content length
    let totalCharLimit = currentModel?.longConversationWarningCharacterLimit
    if (!siteInfo) totalCharLimit += currentModel?.maxPageContentLength

    if (
      !hasDismissedLongConversationInfo &&
      chatHistoryCharTotal >= totalCharLimit
    ) {
      return true
    }

    return false
  }, [conversationHistory, currentModel, hasDismissedLongConversationInfo, siteInfo])

  const dismissLongPageWarning = () => {
    setHasDismissedLongPageWarning(true)
  }

  const dismissLongConversationInfo = () => {
    setHasDismissedLongConversationInfo(true)
  }

  const goPremium = () => {
    getPageHandlerInstance().pageHandler.openURL({
      url: URL_GO_PREMIUM
    })
  }

  const managePremium = () => {
    getPageHandlerInstance().pageHandler.openURL({
      url: URL_MANAGE_PREMIUM
    })
  }

  const initialiseForTargetTab = async () => {
    // Replace state from backend
    // TODO(petemill): Perhaps we need a simple GetState mojom function
    // and OnStateChanged event so we
    // don't need to call multiple functions or handle multiple events.
    updateCurrentPremiumStatus()
    getConversationHistory()
    getSuggestedQuestions()
    getSiteInfo()
    getFaviconData()
    getCurrentAPIError()
    getCanShowPremiumPrompt()
  }

  React.useEffect(() => {
    initialiseForTargetTab()

    // This never changes
    getPageHandlerInstance().pageHandler.getModels().then(data => {
      setAllModels(data.models)
      setCurrentModelKey(data.currentModelKey);
    })

    // Setup data event handlers
    getPageHandlerInstance().callbackRouter.onConversationHistoryUpdate.addListener(() => {
      getConversationHistory()
    })
    getPageHandlerInstance().callbackRouter.onAPIRequestInProgress.addListener(setIsGenerating)
    getPageHandlerInstance().callbackRouter.onSuggestedQuestionsChanged
      .addListener((questions: string[], suggestionStatus: mojom.SuggestionGenerationStatus) => {
        setSuggestedQuestions(questions)
        setSuggestionStatus(suggestionStatus)
      }
    )
    getPageHandlerInstance().callbackRouter.onFaviconImageDataChanged.addListener((faviconImageData: number[]) => setFavIconUrl(toBlobURL(faviconImageData)))
    getPageHandlerInstance().callbackRouter.onSiteInfoChanged.addListener(
      handleSiteInfo
    )
    getPageHandlerInstance().callbackRouter.onAPIResponseError.addListener((error: mojom.APIError) => setCurrentError(error))

    getPageHandlerInstance().callbackRouter.onModelChanged.addListener((modelKey: string) => {
      setCurrentModelKey(modelKey)
    })

    // Since there is no server-side event for premium status changing,
    // we should check often. And since purchase or login is performed in
    // a separate WebContents, we can check when focus is returned here.
    window.addEventListener('focus', () => {
      updateCurrentPremiumStatus()
    })

    document.addEventListener('visibilitychange', (e) => {
      if (document.visibilityState === 'visible') {
        updateCurrentPremiumStatus()
      }
    })
  }, [])

  const store: AIChatContext = {
    allModels,
    currentModel,
    showModelIntro,
    conversationHistory,
    isGenerating,
    suggestedQuestions,
    suggestionStatus,
    siteInfo: siteInfo,
    favIconUrl,
    currentError,
    hasAcceptedAgreement,
    apiHasError,
    shouldDisableUserInput,
    isPremiumStatusFetching: premiumStatus === undefined,
    isPremiumUser,
    isPremiumUserDisconnected: premiumStatus === mojom.PremiumStatus.ActiveDisconnected,
    canShowPremiumPrompt,
    shouldShowLongPageWarning,
    shouldShowLongConversationInfo,
    setCurrentModel,
    switchToDefaultModel,
    goPremium,
    managePremium,
    generateSuggestedQuestions,
    handleAgreeClick,
    dismissPremiumPrompt,
    getCanShowPremiumPrompt,
    userRefreshPremiumSession,
    dismissLongPageWarning,
    dismissLongConversationInfo,
  }

  return (
    <DataContext.Provider value={store}>{props.children}</DataContext.Provider>
  )
}

export default DataContextProvider

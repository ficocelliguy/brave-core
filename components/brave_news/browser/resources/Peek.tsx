// Copyright (c) 2023 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import Icon from '@brave/leo/react/icon';
import { color, effect, gradient, radius, spacing } from '@brave/leo/tokens/css';
import * as React from 'react';
import styled, { keyframes } from 'styled-components';
import { NEWS_FEED_CLASS } from './Feed';
import { MetaInfo } from './feed/ArticleMetaRow';
import Card, { SmallImage, Title } from './feed/Card';
import { useBraveNews } from './shared/Context';
import { useUnpaddedImageUrl } from './shared/useUnpaddedImageUrl';
import Variables from './Variables';

const NewsButton = styled.button`
  cursor: pointer;

  padding: ${spacing.m} ${spacing.xl};

  border: none;
  border-radius: ${radius.m};

  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(40px);

  color: ${color.white};

  & > leo-icon[name="news-default"] {
    --leo-icon-color: ${gradient.iconsActive};
  }

  & > leo-icon[name="carat-down"] {
    --leo-icon-color: rgba(255, 255, 255, 0.25);
  }

  display: flex;
  flex-direction: row;
  align-items: center;
  gap: ${spacing.m};

  transition: opacity 150ms ease-in-out;

  &:focus-visible {
    outline: none;
    box-shadow: ${effect.focusState};
  }

  &:hover {
    opacity: 0.9;
  }

  &:active {
    opacity: 1;
  }
`

const PeekingCard = styled(Card)`
  width: 540px;
  background: rgba(255, 255, 255, 0.10);
  box-shadow: 0px 4px 4px 0px rgba(0, 0, 0, 0.10);
  backdrop-filter: blur(40px);

  display: flex;
  flex-direction: row;
  gap: ${spacing.m};
  justify-content: space-between;
`

const animateIn = keyframes`
  from {
    transform: translateY(150%);
  }

  to {
    transform: translate(0%);
  }
`;

const Container = styled(Variables)`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${spacing.m};

  animation: ${animateIn} 0.1s ease-in-out 1;

  // As we scroll down the PeekingCard should fade out. At 20% scroll it should
  // be completely invisible.
  opacity: calc(1 - (var(--ntp-scroll-percent) * 5));
`

const scrollToNews = () => {
  const news = document.querySelector(`.${NEWS_FEED_CLASS}`)
  news?.scrollIntoView({ behavior: 'smooth' })
}

export default function Peek() {
  const { feedV2 } = useBraveNews()
  const top = feedV2?.items?.find(a => a.article || a.hero)
  const data = (top?.hero ?? top?.article)?.data
  const imageUrl = useUnpaddedImageUrl(data?.image.paddedImageUrl?.url ?? data?.image.imageUrl?.url, undefined, true)

  if (!data) return null

  return <Container>
    <NewsButton onClick={scrollToNews}>
      <Icon name='news-default' />
      News
      <Icon name='carat-down' />
    </NewsButton>
    <PeekingCard onClick={scrollToNews}>
      <div>
        <MetaInfo article={data} />
        <Title>{data.title}</Title>
      </div>
      <SmallImage src={imageUrl} />
    </PeekingCard>
  </Container>
}


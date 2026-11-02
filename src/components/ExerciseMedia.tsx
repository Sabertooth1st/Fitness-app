import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import { resolveMedia, type ResolvedMedia } from '../content/media';
import type { Exercise } from '../domain/types';
import { useApp } from '../features/app/AppState';
import { useT } from '../i18n';
import { radius } from '../theme/tokens';
import { Body, Card } from './ui';

export function useReducedMotion(): boolean {
  const { snapshot } = useApp();
  const [system, setSystem] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setSystem);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setSystem);
    return () => sub.remove();
  }, []);
  return snapshot?.profile?.reducedMotion === 'on' || system;
}

function Video({ media, name }: { media: ResolvedMedia; name: string }) {
  const player = useVideoPlayer(media.uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  return (
    <VideoView
      player={player}
      nativeControls
      contentFit="contain"
      accessibilityLabel={name}
      style={{ width: '100%', aspectRatio: 1, borderRadius: radius.lg }}
    />
  );
}

/** Demonstration with honest fallbacks: still image or written steps only. */
export function ExerciseMedia({ exercise }: { exercise: Exercise }) {
  const t = useT();
  const reduced = useReducedMotion();
  const media = resolveMedia(exercise.media);
  const name = exercise.name.en;

  if (!media) {
    return (
      <Card tone="warning">
        <Body>{t('exercise.noMedia')}</Body>
      </Card>
    );
  }
  if (media.mediaType === 'video/mp4' && !reduced) return <Video media={media} name={name} />;
  const still = media.mediaType === 'video/mp4' ? media.stillUri : media.uri;
  if (!still) {
    return (
      <Card tone="warning">
        <Body>{t('exercise.noMedia')}</Body>
      </Card>
    );
  }
  return (
    <View>
      <Image source={{ uri: still }} accessibilityLabel={name} contentFit="contain" style={{ width: '100%', aspectRatio: 1, borderRadius: radius.lg }} />
    </View>
  );
}

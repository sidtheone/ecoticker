# Monkey Finding — Build

## Technique: Inversion

## Target: "change" concept — HeroSection computes inline, TopicList uses topic.change + formatChange()

## Finding

HeroSection recomputes `change = currentScore - previousScore` inline and formats it with bespoke logic (`▲ +${change}`). TopicList uses the pre-computed `topic.change` field and shared `formatChange()` utility. Two components on the same page, same metric, different derivation and different format (arrow-before-number vs number-before-arrow).

## Resolution

During normalization: update HeroSection to use `topic.change` and `formatChange()` instead of inline computation and formatting. One formatter for one concept.

## Survived: No — fix during normalization

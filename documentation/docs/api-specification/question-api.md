---
title: Question API
description: OpenAPI specification for the GET /api/question endpoint
sidebar_position: 3
hide_table_of_contents: true
---

import ApiDocMdx from '@theme/ApiDocMdx';

# Question API

The `/api/question` route serves a single coding challenge question from the
dataset. Questions can be filtered by ID, slug, difficulty, or topic tag.
When multiple questions match the filters a random one is returned, making the
endpoint suitable for powering randomised game sessions.

<ApiDocMdx id="question-api" />

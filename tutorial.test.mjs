import test from 'node:test';import assert from 'node:assert/strict';import {lessons} from './lessons.mjs';import {run} from './api.mjs';
for(const lesson of lessons)test(`Persian lesson ${lesson.id} executes with documented output`,()=>assert.equal(run(lesson.source).output,lesson.output));

'use strict'
import React, { Component } from 'react'
import { Alert } from 'react-native';


import { user } from './sections/user'
import { base } from './sections/base'
import { stones } from './sections/stones'
import { groups } from './sections/groups'
import { locations } from './sections/locations'
import { devices } from './sections/devices'
import { appliances } from './sections/appliances'


function mixin(base, section) {
  for (let key in section) {
    if (section.hasOwnProperty(key))
      base[key] = section[key]
  }
}

function combineSections() {
  let result = {};
  mixin(result, base);
  mixin(result, user);
  mixin(result, stones);
  mixin(result, locations);
  mixin(result, groups);
  mixin(result, devices);
  mixin(result, appliances);
  return result;
}

/**
 * This adds all sections into the CLOUD
 */
export const CLOUD = combineSections();

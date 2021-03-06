import * as React from 'react'; import { Component } from 'react';
import {
  Keyboard,
  TextInput,
} from 'react-native';

import { eventBus } from '../../../util/EventBus'
import {colors} from "../../styles";

export class TextEditInput extends Component<any, any> {
  isInFocus : boolean;
  initialized : boolean;
  refName : string;
  blurListener : any;
  unsubscribe : any;
  blurValue : string;

  constructor() {
    super();
    this.initialized = false;
    this.blurValue = null;
    this.isInFocus = false;
    this.refName = (Math.random() * 1e9).toString(36);

    // make sure we submit the data if the keyboard is hidden.
    this.blurListener = Keyboard.addListener('keyboardDidHide', () => { this.blur();  });
    this.unsubscribe = eventBus.on("inputComplete", () => { this.blur(); })
  }

  componentWillUnmount() {
    if (this.isInFocus === true) {
      this.blur();
    }
    this.unsubscribe();
    this.blurListener.remove();
  }

  componentDidMount() { }

  focus() {
    this.isInFocus = true;
    this.initialized = true;
    this.blurValue = null;
    (this.refs[this.refName] as any).measure((fx, fy, width, height, px, py) => {
      eventBus.emit("focus", py);
    })
  }

  blur() {
    if (this.initialized) {
      if (this.blurValue !== this.props.value) {
        this.blurValue = this.props.value;
        this.isInFocus = false;
        if (this.props.__validate) {
          this.props.__validate(this.props.value);
        }
        if (this.props.endCallback) {
          this.props.endCallback(this.props.value);
        }
        eventBus.emit('blur');
      }
    }
  }

  _checkForEnter(newValue) {
    if (this.props.submitOnEnter === true) {
      if (newValue) {
        if (newValue.indexOf('\n') !== -1) {
          setTimeout(() => { (this.refs[this.refName] as any).blur(); },0);
          return newValue.replace('\n','');
        }
      }
    }
    return newValue;
  }

  render() {
    return (
      <TextInput
        ref={this.refName}
        autoFocus={this.props.autoFocus || false}
        autoCapitalize={this.props.secureTextEntry ? undefined : this.props.autoCapitalize || 'words'}
        autoCorrect={this.props.autoCorrect || false}
        keyboardType={ this.props.keyboardType || 'default'}
        blurOnSubmit={this.props.blurOnSubmit || (this.props.multiline !== false)}
        maxLength={this.props.maxLength}
        multiline={ this.props.multiline }
        onEndEditing={() => { this.blur(); }}
        onBlur={() => { this.blur(); }}
        onSubmitEditing={() => { this.blur(); }}
        onChangeText={(newValue) => {
          if (this.props.maxLength && newValue) {
            if (newValue.length > this.props.maxLength) {
              newValue = newValue.substr(0, this.props.maxLength)
            }
          }

          let updatedValue = this._checkForEnter(newValue);
          this.props.callback(updatedValue);
        }}
        onFocus={() => {this.focus();}}
        placeholder={this.props.placeholder || this.props.label}
        placeholderTextColor={this.props.placeholderTextColor}
        returnKeyType={this.props.returnKeyType}
        style={[{flex:1, position:'relative', top:1, fontSize:16}, this.props.style]}
        secureTextEntry={this.props.secureTextEntry}
        value={this.props.value}
      />
    );
  }
}

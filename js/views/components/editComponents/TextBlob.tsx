import * as React from 'react'; import { Component } from 'react';
import {
  TextInput,
  Text,
  View
} from 'react-native';
import { Icon } from '../Icon';
import { styles, colors } from '../../styles'
import { TextEditInput } from './TextEditInput'
import { emailChecker, characterChecker, numberChecker } from '../../../util/Util'

export class TextBlob extends Component<any, any> {
  refName : string;

  constructor() {
    super();
    this.state = {validation: undefined};
    this.refName = (Math.random() * 1e9).toString(36);
  }

  componentDidMount() {
    (this.refs[this.refName] as any).focus()
  }

  render() {
    return (
      <View style={[styles.listView, {height:this.props.barHeight, paddingTop:5}]}>
        <TextEditInput
          submitOnEnter={true}
          blurOnSubmit={true}
          autoFocus={true}
          ref={this.refName}
          {...this.props}
          autoCorrect={true}
          returnKeyType={"done"}
          autoCapitalize={'sentences'}
          multiline={true}
          maxLength={this.props.maxLength}
          placeholder={this.props.placeholder || this.props.label}
          value={this.props.value}
        />
      </View>
    );

  }
}

import { Authenticator } from '@aws-amplify/ui-react';

export default function CustomAuthenticator() {
  return (
    <Authenticator
      formFields={{
        signUp: {
          name: {
            label: 'Username',
            placeholder: 'Enter your username',
            order: 1,
          },
          email: {
            label: 'Email',
            placeholder: 'Enter your email',
            order: 2,
          },
          password: {
            label: 'Password',
            placeholder: 'Enter your password',
            order: 3,
          },
          confirm_password: {
            label: 'Confirm Password',
            placeholder: 'Confirm your password',
            order: 4,
          },
        },
      }}
    />
  );
}

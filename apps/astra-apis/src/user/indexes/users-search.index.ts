import type {User as IUser} from '@ids/data-models';
import {AbstractJavaScriptIndexCreationTask} from 'ravendb';

type UsersSearchEntry = {
  query: string[];
  isDeleted: boolean;
};

export function buildUsersSearchEntry(user: IUser): UsersSearchEntry {
  return {
    query: [user.displayName || '', user.email || '', user.username || ''],
    isDeleted: user.isDeleted,
  };
}

export class Users_Search extends AbstractJavaScriptIndexCreationTask<IUser, UsersSearchEntry> {
  public constructor() {
    super();
    this.map('users', buildUsersSearchEntry);
    // Enable Lucene StandardAnalyzer full-text search on the query field.
    this.index('query', 'Search');
    this.store('query', 'No');
  }
}

export class CreateCommitDto {
  sha: string;
  repo: string;
  owner: string;
  author_name: string;
  author_email: string;
  date: string;
  message: string;
  parents?: any;
  commit_raw?: any;
}
